import { supabase } from "./supabase";

/* ---------- AUTH ---------- */

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

/* ---------- COURSES ---------- */

export async function getCourse(courseId: string) {
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();

  if (error) throw error;
  return data;
}

export async function getCourseAssignments(courseId: string) {
  const { data, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("course_id", courseId);

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

/* ---------- ENROLLMENT ---------- */

export async function getStudentCourses(studentEmail: string) {
  const { data, error } = await supabase
    .from("enrollments")
    .select("course_id, courses(*)")
    .eq("student_email", studentEmail);

  if (error) throw error;

  return data?.map((row: any) => row.courses) ?? [];
}

/* ---------- PROFILES ---------- */

export async function getLearningProfile(email: string) {
  const { data, error } = await supabase
    .from("learning_profiles")
    .select("*")
    .eq("student_email", email)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function upsertLearningProfile(email: string, profileData: any) {
  const { error } = await supabase.from("learning_profiles").upsert({
    student_email: email,
    data: profileData,
  });

  if (error) throw error;
}