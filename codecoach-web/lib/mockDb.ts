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
  // MVP placeholders for “learning trace + summary”
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

function load(): DB {
  if (typeof window === "undefined") {
    return { courses: [], assignments: [], enrollments: [], submissions: [], seeded: false };
  }
  const raw = localStorage.getItem(KEY);
  if (!raw) return { courses: [], assignments: [], enrollments: [], submissions: [], seeded: false };
  try {
    return JSON.parse(raw) as DB;
  } catch {
    return { courses: [], assignments: [], enrollments: [], submissions: [], seeded: false };
  }
}

function save(db: DB) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function seedIfNeeded() {
  const db = load();
  if (db.seeded) return;

  const courseId = "course_cs101";
  const assignmentId = "asmt_a1";

  const seedCourse: Course = {
    id: courseId,
    title: "CS 101 — Intro to Programming",
    term: "Winter 2026",
    joinCode: "NU-CS-101",
    ownerEmail: "prof@northwestern.edu",
  };

  const seedAssignment: Assignment = {
    id: assignmentId,
    courseId,
    title: "A1 — Learning Trace Warmup",
    instructions:
      "Your submission is your learning process: use CodeCoach in VS Code, ask questions, capture your reasoning, and export a learning summary. You do NOT need a perfect final program.\n\nGoal: demonstrate how you think and learn.",
    fundamentals: ["Variables & types", "Functions", "Conditionals", "Loops", "Debugging mindset"],
    objectives: ["Practice asking good debugging questions", "Explain your approach in your own words", "Reflect on what you learned"],
  };

  db.courses = [seedCourse];
  db.assignments = [seedAssignment];
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
  const courseIds = new Set(db.enrollments.filter(e => e.studentEmail === studentEmail).map(e => e.courseId));
  return db.courses.filter(c => courseIds.has(c.id));
}

export function getCourse(courseId: string) {
  const db = load();
  const c = db.courses.find((x) => x.id === courseId);
  if (!c) throw new Error("Course not found.");
  return c;
}

export function getCourseAssignments(courseId: string) {
  const db = load();
  return db.assignments.filter(a => a.courseId === courseId);
}

export function getAssignment(assignmentId: string) {
  const db = load();
  const a = db.assignments.find(x => x.id === assignmentId);
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
    joinCode: `NU-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.floor(100 + Math.random()*900)}`,
    ownerEmail,
  };
  db.courses.push(c);
  save(db);
  return c;
}

export function getInstructorCourses(ownerEmail: string) {
  const db = load();
  return db.courses.filter(c => c.ownerEmail === ownerEmail);
}

export function getRoster(courseId: string) {
  const db = load();
  return db.enrollments.filter(e => e.courseId === courseId).map(e => e.studentEmail);
}

export function getSubmissionsForCourse(courseId: string) {
  const db = load();
  const assignmentIds = new Set(db.assignments.filter(a => a.courseId === courseId).map(a => a.id));
  return db.submissions.filter(s => assignmentIds.has(s.assignmentId));
}