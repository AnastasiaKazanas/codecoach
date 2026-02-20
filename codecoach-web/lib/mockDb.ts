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

function makeJoinCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function normalizeCourse(c: any) {
  if (!c) return c;
  return {
    ...c,
    // keep your old UI working:
    joinCode: c.joinCode ?? c.join_code ?? null,
  };
}

export async function getCourse(id: string) {
  const { data, error } = await supabase.from("courses").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return normalizeCourse(data);
}

export async function getAssignment(id: string) {
  const { data, error } = await supabase.from("assignments").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getCourseAssignments(courseId: string) {
  const { data, error } = await supabase.from("assignments").select("*").eq("course_id", courseId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getInstructorCourses(email: string) {
  const { data, error } = await supabase.from("courses").select("*").eq("instructor_email", email);
  if (error) throw new Error(error.message);
  return (data ?? []).map(normalizeCourse);
}

export async function createCourse(payload: { title: string; term: string; instructor_email: string }) {
  const join_code = makeJoinCode();

  const { data, error } = await supabase
    .from("courses")
    .insert({
      title: payload.title,
      term: payload.term,
      instructor_email: payload.instructor_email,
      join_code, // ✅ IMPORTANT (many schemas require this)
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return normalizeCourse(data);
}

export async function createAssignment(payload: any) {
  const { data, error } = await supabase.from("assignments").insert(payload).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getRoster(courseId: string) {
  const { data, error } = await supabase.from("enrollments").select("*").eq("course_id", courseId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSubmissionsForAssignment(assignmentId: string) {
  const { data, error } = await supabase.from("submissions").select("*").eq("assignment_id", assignmentId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function seedIfNeeded() {
  // no longer needed
  return;
}

export async function getCourseProfile(courseId: string, email: string) {
  const { data, error } = await supabase
    .from("learning_profiles")
    .select("*")
    .eq("course_id", courseId)
    .eq("student_email", email)
    .single();

  // if you want "no profile yet" to be allowed, handle not-found gracefully:
  if (error && error.code !== "PGRST116") throw new Error(error.message);

  return data ?? null;
}

export async function getSubmissionsForStudentInCourse(courseId: string, email: string) {
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .eq("course_id", courseId)
    .eq("student_email", email);

  if (error) throw new Error(error.message);
  return data ?? [];
}