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
 
export async function getCourse(id: string) {
  const { data } = await supabase
    .from("courses")
    .select("*")
    .eq("id", id)
    .single();
  return data;
}

export async function getAssignment(id: string) {
  const { data } = await supabase
    .from("assignments")
    .select("*")
    .eq("id", id)
    .single();
  return data;
}

export async function getCourseAssignments(courseId: string) {
  const { data } = await supabase
    .from("assignments")
    .select("*")
    .eq("course_id", courseId);
  return data ?? [];
}

export async function getInstructorCourses(email: string) {
  const { data } = await supabase
    .from("courses")
    .select("*")
    .eq("instructor_email", email);
  return data ?? [];
}

export async function createCourse(payload: any) {
  const { data } = await supabase
    .from("courses")
    .insert(payload)
    .select()
    .single();
  return data;
}

export async function createAssignment(payload: any) {
  const { data } = await supabase
    .from("assignments")
    .insert(payload)
    .select()
    .single();
  return data;
}

export async function getRoster(courseId: string) {
  const { data } = await supabase
    .from("enrollments")
    .select("*")
    .eq("course_id", courseId);
  return data ?? [];
}

export async function getSubmissionsForAssignment(assignmentId: string) {
  const { data } = await supabase
    .from("submissions")
    .select("*")
    .eq("assignment_id", assignmentId);
  return data ?? [];
}

export async function seedIfNeeded() {
  // no longer needed
  return;
}

export async function getCourseProfile(courseId: string, email: string) {
  const { data } = await supabase
    .from("learning_profiles")
    .select("*")
    .eq("course_id", courseId)
    .eq("student_email", email)
    .single();

  return data;
}

export async function getSubmissionsForStudentInCourse(
  courseId: string,
  email: string
) {
  const { data } = await supabase
    .from("submissions")
    .select("*")
    .eq("course_id", courseId)
    .eq("student_email", email);

  return data ?? [];
}
