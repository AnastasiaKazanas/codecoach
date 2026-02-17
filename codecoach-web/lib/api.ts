import { getAuth } from "./storage";

const AUTH = process.env.NEXT_PUBLIC_AUTH_API!;
const COURSES = process.env.NEXT_PUBLIC_COURSES_API!;
const ASSIGNMENTS = process.env.NEXT_PUBLIC_ASSIGNMENTS_API!;
const SESSIONS = process.env.NEXT_PUBLIC_SESSIONS_API!;

async function apiFetch<T>(base: string, path: string, init: RequestInit = {}): Promise<T> {
  const auth = getAuth();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
      ...(init.headers || {})
    },
    cache: "no-store"
  });

  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.message || `${res.status} ${res.statusText}`);
  return data as T;
}

export const AuthAPI = {
  login: (email: string, role: "student" | "instructor") =>
    apiFetch<{ token: string; user: { id: string; email: string; role: string } }>(AUTH, "/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, role })
    })
};

export const CoursesAPI = {
  myCourses: () =>
    apiFetch<{ courses: Array<{ id: string; title: string; joinCode: string; roleInCourse: string }> }>(
      COURSES,
      "/me/courses",
      { method: "GET" }
    ),
  createCourse: (title: string) =>
    apiFetch<{ id: string; title: string; joinCode: string }>(COURSES, "/courses", {
      method: "POST",
      body: JSON.stringify({ title })
    }),
  joinCourse: (joinCode: string) =>
    apiFetch<{ ok: true; courseId: string; title: string }>(COURSES, "/courses/join", {
      method: "POST",
      body: JSON.stringify({ joinCode })
    })
};

export const AssignmentsAPI = {
  listForCourse: (courseId: string) =>
    apiFetch<{ assignments: Array<{ id: string; courseId: string; title: string; createdAtISO: string }> }>(
      ASSIGNMENTS,
      `/courses/${courseId}/assignments`,
      { method: "GET" }
    ),
  create: (courseId: string, payload: { title: string; instructions: string; fundamentals: string[]; objectives: string[] }) =>
    apiFetch<{ id: string }>(ASSIGNMENTS, "/assignments", {
      method: "POST",
      body: JSON.stringify({ courseId, ...payload })
    }),
  get: (assignmentId: string) =>
    apiFetch<{ id: string; courseId: string; title: string; instructions: string; fundamentals: string[]; objectives: string[] }>(
      ASSIGNMENTS,
      `/assignments/${assignmentId}`,
      { method: "GET" }
    )
};

export const SessionsAPI = {
  instructorSessionsForAssignment: (assignmentId: string) =>
    apiFetch<{ sessions: Array<{ id: string; studentId: string; status: string; createdAtISO: string; submittedAtISO: string | null }> }>(
      SESSIONS,
      `/instructor/assignments/${assignmentId}/sessions`,
      { method: "GET" }
    ),
  instructorTrace: (sessionId: string) =>
    apiFetch<{ session: any; events: Array<{ type: string; ts: string; payload: any }> }>(
      SESSIONS,
      `/instructor/sessions/${sessionId}/trace`,
      { method: "GET" }
    )
};