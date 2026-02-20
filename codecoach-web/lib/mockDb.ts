import { supabase } from "./supabase";

export type StarterFileAsset = {
  path: string;
  filename: string;
  mime: string;
  dataUrl: string;
};

export type StarterBundle = {
  files: StarterFileAsset[];
};

// ---------- helpers ----------
function randomJoinCode(len = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

export async function getAuthUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user; // Supabase auth user (id/email)
}

/**
 * Ensures there's a row in your public.users table for the current auth user.
 * Uses email + role. Role can be "student" or "instructor".
 */
export async function ensureAppUser(role: "student" | "instructor") {
  const user = await getAuthUser();
  const email = user?.email ?? "";
  if (!user?.id || !email) throw new Error("Not signed in.");

  // Try get existing
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

// ---------- courses ----------
export async function getCourse(id: string) {
  const { data, error } = await supabase.from("courses").select("*").eq("id", id).single();
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
  // generate join code (retry a few times if collision)
  for (let attempt = 0; attempt < 5; attempt++) {
    const join_code = randomJoinCode(6);

    const { data, error } = await supabase
      .from("courses")
      .insert({ ...payload, join_code })
      .select("*")
      .single();

    if (!error) return data;
    // if unique violation on join_code, retry
    if (String((error as any).message || "").toLowerCase().includes("join_code")) continue;
    throw error;
  }

  throw new Error("Failed to generate a unique join code. Try again.");
}

// ---------- enrollments / roster ----------
export async function getRoster(courseId: string) {
  // enrollments + users for email
  const { data, error } = await supabase
    .from("enrollments")
    .select("id, student_id, users:student_id ( id, email )")
    .eq("course_id", courseId);

  if (error) throw error;

  // normalize to an array of { studentId, email }
  return (data ?? []).map((r: any) => ({
    enrollmentId: r.id,
    studentId: r.student_id,
    email: r.users?.email ?? "",
  }));
}

// ---------- assignments ----------
export async function getCourseAssignments(courseId: string) {
  const { data, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getAssignment(id: string) {
  const { data, error } = await supabase.from("assignments").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function createAssignment(payload: any) {
  const { data, error } = await supabase.from("assignments").insert(payload).select("*").single();
  if (error) throw error;
  return data;
}

// ---------- submissions ----------
export async function getSubmissionsForAssignment(assignmentId: string) {
  // submissions + users for email
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
  // need assignments to filter by course
  const { data, error } = await supabase
    .from("submissions")
    .select("*, assignments!inner(course_id)")
    .eq("student_id", studentId)
    .eq("assignments.course_id", courseId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// ---------- learning profiles ----------
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

export async function seedIfNeeded() {
  // no-op now
  return;
}