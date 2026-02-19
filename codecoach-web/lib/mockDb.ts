// codecoach-web/lib/mockDb.ts
export type Role = "student" | "instructor";

export type Course = {
  id: string;
  title: string;
  term: string;
  joinCode: string;
  ownerEmail: string; // instructor email
};

export type Assignment = {
  id: string;
  courseId: string;
  title: string;
  instructions: string;
  fundamentals: string[];
  objectives: string[];
};

export type Enrollment = {
  courseId: string;
  studentEmail: string;
};

export type Submission = {
  assignmentId: string;
  studentEmail: string;
  submittedAtISO: string;
  traceCount: number;
  summarySnippet: string;
};

type DB = {
  courses: Course[];
  assignments: Assignment[];
  enrollments: Enrollment[];
  submissions: Submission[];
  seeded: boolean;
};

const KEY = "codecoach.mockdb.v1";

function empty(): DB {
  return { courses: [], assignments: [], enrollments: [], submissions: [], seeded: false };
}

function load(): DB {
  if (typeof window === "undefined") return empty();
  const raw = localStorage.getItem(KEY);
  if (!raw) return empty();
  try {
    return JSON.parse(raw) as DB;
  } catch {
    return empty();
  }
}

function save(db: DB) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function mkJoinCode(prefix: string) {
  return `NU-${prefix}-${Math.floor(100 + Math.random() * 900)}`;
}

export function seedIfNeeded() {
  const db = load();
  if (db.seeded) return;

  const ownerEmail = "prof@northwestern.edu";

  const c1: Course = {
    id: "CS336",
    title: "CS 336 — Design & Analysis of Algorithms",
    term: "Winter 2026",
    joinCode: "NU-CS336-101",
    ownerEmail,
  };

  const c2: Course = {
    id: "CS213",
    title: "CS 213 — Computer Systems",
    term: "Winter 2026",
    joinCode: "NU-CS213-202",
    ownerEmail,
  };

  const c3: Course = {
    id: "GEN",
    title: "Debugging Workshop",
    term: "Winter 2026",
    joinCode: "NU-GEN-303",
    ownerEmail,
  };

  const a1: Assignment = {
    id: "cs336-hw-greedy-1",
    courseId: "CS336",
    title: "CS 336 — Greedy Scheduling (Demo)",
    fundamentals: ["Greedy choice", "Exchange argument", "Runtime: sorting + scan"],
    objectives: ["Choose a greedy strategy", "Explain correctness (exchange argument)", "Analyze runtime"],
    instructions: [
      "You are given intervals (start, finish).",
      "Pick a maximum-size subset of non-overlapping intervals.",
      "Explain *why* your greedy choice is optimal using an exchange argument.",
      "Do not paste full solution code. Use pseudocode or a toy example.",
    ].join("\n"),
  };

  const a2: Assignment = {
    id: "cs213-asm-stack-1",
    courseId: "CS213",
    title: "CS 213 — Stack Frames & Calling Convention (Demo)",
    fundamentals: ["SysV AMD64 calling convention", "Stack frames", "rsp movement"],
    objectives: [
      "Explain what push/pop do to rsp",
      "Identify arg registers vs return register",
      "Reason about local stack allocation",
    ],
    instructions: [
      "Given a short x86-64 snippet, explain the stack frame setup/teardown.",
      "Identify where arguments are passed (registers/stack).",
      "Explain what 'sub $0x20, %rsp' implies.",
    ].join("\n"),
  };

  const a3: Assignment = {
    id: "general-debugging-1",
    courseId: "GEN",
    title: "Debugging Mindset — Minimal Repro (Demo)",
    fundamentals: ["Hypothesis-driven debugging", "Binary search debugging", "Logging"],
    objectives: ["Create a minimal repro", "Isolate the variable that changes behavior"],
    instructions: [
      "Describe the bug in one sentence.",
      "List 3 hypotheses.",
      "Explain the fastest experiment to rule out each hypothesis.",
      "Write a minimal reproduction step-by-step.",
    ].join("\n"),
  };

  db.courses = [c1, c2, c3];
  db.assignments = [a1, a2, a3];
  db.enrollments = []; // students join by code
  db.submissions = [];
  db.seeded = true;
  save(db);
}

/* STUDENT */
export function joinCourseByCode(studentEmail: string, joinCode: string) {
  const db = load();
  const course = db.courses.find((c) => c.joinCode.toLowerCase() === joinCode.trim().toLowerCase());
  if (!course) throw new Error("Invalid join code.");

  const already = db.enrollments.some((e) => e.courseId === course.id && e.studentEmail === studentEmail);
  if (!already) db.enrollments.push({ courseId: course.id, studentEmail });

  save(db);
  return course;
}

export function getStudentCourses(studentEmail: string) {
  const db = load();
  const courseIds = new Set(db.enrollments.filter((e) => e.studentEmail === studentEmail).map((e) => e.courseId));
  return db.courses.filter((c) => courseIds.has(c.id));
}

export function getCourse(courseId: string) {
  const db = load();
  const c = db.courses.find((x) => x.id === courseId);
  if (!c) throw new Error("Course not found.");
  return c;
}

export function getCourseAssignments(courseId: string) {
  const db = load();
  return db.assignments.filter((a) => a.courseId === courseId);
}

export function getAssignment(assignmentId: string) {
  const db = load();
  const a = db.assignments.find((x) => x.id === assignmentId);
  if (!a) throw new Error("Assignment not found.");
  return a;
}

/* INSTRUCTOR */
export function createCourse(ownerEmail: string, title: string, term: string) {
  const db = load();
  const c: Course = {
    id: uid("course"),
    title: title.trim(),
    term: term.trim(),
    joinCode: mkJoinCode(title.trim().split(" ")[0]?.toUpperCase() || "COURSE"),
    ownerEmail,
  };
  db.courses.push(c);
  save(db);
  return c;
}

export function getInstructorCourses(ownerEmail: string) {
  const db = load();
  return db.courses.filter((c) => c.ownerEmail === ownerEmail);
}

export function getRoster(courseId: string) {
  const db = load();
  return db.enrollments.filter((e) => e.courseId === courseId).map((e) => e.studentEmail);
}

export function getSubmissionsForCourse(courseId: string) {
  const db = load();
  const assignmentIds = new Set(db.assignments.filter((a) => a.courseId === courseId).map((a) => a.id));
  return db.submissions.filter((s) => assignmentIds.has(s.assignmentId));
}

/* OPTIONAL: add instructor ability to create assignments */
export function createAssignment(courseId: string, payload: Omit<Assignment, "id" | "courseId">) {
  const db = load();
  // validate course exists
  const c = db.courses.find((x) => x.id === courseId);
  if (!c) throw new Error("Course not found.");

  const a: Assignment = {
    id: uid("asmt"),
    courseId,
    title: payload.title.trim(),
    instructions: payload.instructions.trim(),
    fundamentals: payload.fundamentals || [],
    objectives: payload.objectives || [],
  };

  db.assignments.push(a);
  save(db);
  return a;
}

/* OPTIONAL: record a submission (later: called by API) */
export function upsertSubmission(input: {
  assignmentId: string;
  studentEmail: string;
  traceCount: number;
  summarySnippet: string;
}) {
  const db = load();
  const idx = db.submissions.findIndex(
    (s) => s.assignmentId === input.assignmentId && s.studentEmail === input.studentEmail
  );

  const record: Submission = {
    assignmentId: input.assignmentId,
    studentEmail: input.studentEmail,
    submittedAtISO: new Date().toISOString(),
    traceCount: input.traceCount,
    summarySnippet: input.summarySnippet,
  };

  if (idx >= 0) db.submissions[idx] = record;
  else db.submissions.push(record);

  save(db);
  return record;
}