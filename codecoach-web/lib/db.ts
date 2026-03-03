import { supabase } from "./supabase";

export type Role = "student" | "instructor";

export type StarterFileAsset = {
  path: string;
  filename: string;
  mime: string;
  dataUrl: string;
};

export type StarterBundle = {
  files: StarterFileAsset[];
};

// Option A: store only a Storage reference in the DB
export type StarterBundleRef = {
  zipPath: string;
  open?: string[];
};

/* ---------- HELPERS ---------- */

function randomJoinCode(len = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}
// backward-compat alias
export const getAuthUser = getCurrentUser;

export async function getUserIdByEmail(email: string) {
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function getUserRoleByEmail(email: string): Promise<Role | null> {
  const { data, error } = await supabase
    .from("users")
    .select("role")
    .eq("email", email)
    .maybeSingle();
  if (error) throw error;
  return (data?.role as Role) ?? null;
}

/**
 * Ensures there's a row in public.users for the currently-authenticated user.
 * Uses auth.user.id as users.id (recommended).
 */
export async function ensureAppUser(role: Role) {
  const user = await getCurrentUser();
  const email = user?.email ?? "";
  if (!user?.id || !email) throw new Error("Not signed in.");

  // Try get existing by id
  const existing = await supabase.from("users").select("*").eq("id", user.id).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  // Create
  const created = await supabase
    .from("users")
    .insert({ id: user.id, email, role })
    .select("*")
    .single();

  if (created.error) throw created.error;
  return created.data;
}

// aliases your UI might import
export const ensureUser = async (email: string, role: Role) => {
  // Use email upsert as a fallback helper (does NOT set id unless your table allows)
  const { data, error } = await supabase
    .from("users")
    .upsert({ email, role }, { onConflict: "email" })
    .select("*")
    .single();

  if (error) throw error;
  return data;
};

/* ---------- COURSES ---------- */

export async function getCourse(courseId: string) {
  const { data, error } = await supabase.from("courses").select("*").eq("id", courseId).single();
  if (error) throw error;
  return data;
}

export async function getInstructorCourses(instructorId: string) {
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("instructor_id", instructorId)
    .order("title", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createCourse(payload: { title: string; term?: string; instructor_id: string }) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const join_code = randomJoinCode(6);

    const { data, error } = await supabase
      .from("courses")
      .insert({ ...payload, join_code })
      .select("*")
      .single();

    if (!error) return data;

    // retry if join_code collision
    if (String((error as any).message || "").toLowerCase().includes("join_code")) continue;
    throw error;
  }

  throw new Error("Failed to generate a unique join code. Try again.");
}

/* ---------- ENROLLMENTS / STUDENT COURSES ---------- */

export async function getStudentCourses(studentEmail: string) {
  const studentId = await getUserIdByEmail(studentEmail);

  const { data, error } = await supabase
    .from("enrollments")
    .select("courses(*)")
    .eq("student_id", studentId);

  if (error) throw error;
  return (data ?? []).map((r: any) => r.courses).filter(Boolean);
}

export async function joinCourse(payload: { join_code: string; student_email: string }) {
  const joinCode = payload.join_code?.trim();
  const studentEmail = payload.student_email?.trim();
  if (!joinCode) throw new Error("Join code required.");
  if (!studentEmail) throw new Error("Student email required.");

  const studentId = await getUserIdByEmail(studentEmail);

  const { data: course, error: courseErr } = await supabase
    .from("courses")
    .select("id")
    .eq("join_code", joinCode)
    .single();
  if (courseErr) throw courseErr;

  const { data, error } = await supabase
    .from("enrollments")
    .insert({ student_id: studentId, course_id: course.id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getRoster(courseId: string) {
  const { data, error } = await supabase
    .from("enrollments")
    .select("id, student_id, users:student_id ( id, email )")
    .eq("course_id", courseId);

  if (error) throw error;

  return (data ?? []).map((r: any) => ({
    enrollmentId: r.id,
    studentId: r.student_id,
    email: r.users?.email ?? "",
  }));
}

/* ---------- ASSIGNMENTS ---------- */

export async function getCourseAssignments(courseId: string) {
  const { data, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getAssignment(assignmentId: string) {
  const { data, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("id", assignmentId)
    .single();

  if (error) throw error;
  return data;
}

export async function createAssignment(payload: any) {
  const courseId = payload.course_id ?? payload.courseId;

  const starterZipFile: File | null = payload.starterZipFile ?? null;

  const mapped = {
    course_id: courseId,
    title: payload.title ?? null,

    // DB columns
    instructions_html: payload.instructions_html ?? payload.instructionsHtml ?? null,
    instructions: payload.instructions ?? null,
    tutorial_url: payload.tutorial_url ?? payload.tutorialUrl ?? null,

    // Legacy support: if caller passes starter_bundle/starterBundle and no zip, keep it.
    // If a zip is provided, we will overwrite starter_bundle after uploading to Storage.
    starter_bundle: starterZipFile ? null : (payload.starter_bundle ?? payload.starterBundle ?? null),

    fundamentals: payload.fundamentals ?? null,
    objectives: payload.objectives ?? null,
  };

  const { data: created, error: createErr } = await supabase
    .from("assignments")
    .insert(mapped)
    .select()
    .single();

  if (createErr) throw createErr;

  // Option A: upload starter zip to Storage and store a small reference in starter_bundle
  if (!starterZipFile) return created;

  const assignmentId = created.id as string;
  const rawName = (starterZipFile as any)?.name || "starter.zip";
  const safeName = String(rawName).replace(/[^a-zA-Z0-9._-]/g, "_") || "starter.zip";
  const zipPath = `course_${courseId}/assignment_${assignmentId}/${safeName}`;

  const { error: upErr } = await supabase.storage
    .from("starter-zips")
    .upload(zipPath, starterZipFile, { upsert: true, contentType: "application/zip" });

  if (upErr) throw upErr;

  const starterBundleRef: StarterBundleRef = { zipPath, open: [] };

  const { data: updated, error: updErr } = await supabase
    .from("assignments")
    .update({ starter_bundle: starterBundleRef })
    .eq("id", assignmentId)
    .select()
    .single();

  if (updErr) throw updErr;

  return updated;
}

export async function updateAssignment(payload: {
  id: string;
  course_id?: string;
  courseId?: string;
  title?: string;
  instructionsHtml?: string;
  instructions_html?: string;
  instructions?: string | null;
  tutorialUrl?: string | null;
  tutorial_url?: string | null;
  fundamentals?: string[];
  objectives?: string[];
  starterZipFile?: File | null;
  clearStarterZip?: boolean;
}) {
  const assignmentId = payload.id;

  // Only include fields that are present on the payload so edits are non-destructive.
  const patch: any = {};

  if (typeof payload.title === "string") patch.title = payload.title;

  if ("instructionsHtml" in payload || "instructions_html" in payload) {
    patch.instructions_html = payload.instructions_html ?? payload.instructionsHtml ?? null;
  }

  if ("instructions" in payload) {
    patch.instructions = payload.instructions ?? null;
  }

  if ("tutorialUrl" in payload || "tutorial_url" in payload) {
    patch.tutorial_url = payload.tutorial_url ?? payload.tutorialUrl ?? null;
  }

  if ("fundamentals" in payload) patch.fundamentals = payload.fundamentals ?? null;
  if ("objectives" in payload) patch.objectives = payload.objectives ?? null;

  const starterZipFile: File | null = payload.starterZipFile ?? null;
  const clearStarterZip = !!payload.clearStarterZip;

  // If user explicitly clears, clear first (unless they are also uploading a replacement zip).
  if (clearStarterZip && !starterZipFile) {
    patch.starter_bundle = null;
  }

  // First apply patch (metadata/text fields)
  if (Object.keys(patch).length > 0) {
    const { error: updErr } = await supabase.from("assignments").update(patch).eq("id", assignmentId);
    if (updErr) throw updErr;
  }

  // Option A: replace starter zip if provided
  if (starterZipFile) {
    const current = await getAssignment(assignmentId);
    const courseId = current.course_id ?? (payload.course_id ?? payload.courseId);
    if (!courseId) throw new Error("Missing course id for starter zip upload.");

    // Use a stable name so updates overwrite instead of creating orphan zips.
    const zipPath = `course_${courseId}/assignment_${assignmentId}/starter.zip`;

    const { error: upErr } = await supabase.storage
      .from("starter-zips")
      .upload(zipPath, starterZipFile, { upsert: true, contentType: "application/zip" });

    if (upErr) throw upErr;

    const starterBundleRef: StarterBundleRef = { zipPath, open: [] };

    const { error: sbErr } = await supabase
      .from("assignments")
      .update({ starter_bundle: starterBundleRef })
      .eq("id", assignmentId);

    if (sbErr) throw sbErr;
  }

  // Return fresh row
  return await getAssignment(assignmentId);
}

export async function getStarterZipSignedUrl(zipPath: string, expiresSeconds = 60 * 15) {
  const { data, error } = await supabase.storage
    .from("starter-zips")
    .createSignedUrl(zipPath, expiresSeconds);

  if (error) throw error;
  return data?.signedUrl ?? "";
}

/* ---------- SUBMISSIONS ---------- */

export async function getSubmissionsForAssignment(assignmentId: string) {
  const { data, error } = await supabase
    .from("submissions")
    .select("*, users:student_id ( email )")
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((s: any) => ({
    ...s,
    studentEmail: s.users?.email ?? "",
  }));
}

export async function getSubmissionsForStudentInCourse(courseId: string, studentId: string) {
  const { data, error } = await supabase
    .from("submissions")
    .select("*, assignments!inner(course_id)")
    .eq("student_id", studentId)
    .eq("assignments.course_id", courseId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/* ---------- LEARNING PROFILES ---------- */
/**
 * Use this from student pages: (courseId, studentEmail)
 * This matches the import your screenshot showed: getLearningProfile(...)
 */
export async function getLearningProfile(studentEmail: string) {
  const studentId = await getUserIdByEmail(studentEmail);

  const { data, error } = await supabase
    .from("learning_profiles")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data; // can be null
}

// Instructor-side helper if you already have studentId
export async function getCourseProfile(courseId: string, studentId: string) {
  const { data, error } = await supabase
    .from("learning_profiles")
    .select("*")
    .eq("course_id", courseId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertLearningProfile(courseId: string, studentId: string, patch: any) {
  const { data, error } = await supabase
    .from("learning_profiles")
    .upsert(
      {
        course_id: courseId,
        student_id: studentId,
        ...patch,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "course_id,student_id" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function seedIfNeeded() {
  return;
}