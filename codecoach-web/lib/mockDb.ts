export type Role = "student" | "instructor";

export type Course = {
  id: string;
  title: string;
  term: string;
  joinCode: string;
  ownerEmail: string; // instructor email
};

export type ResourceLink = { title: string; url: string };

export type StarterFileAsset = {
  path: string;
  filename: string;
  mime: string;
  dataUrl: string;  
};

export type StarterBundle = {
  files: StarterFile[];
};

export type StarterAsset = {
  filename: string;
  mime: string;
  dataUrl: string; // base64 data URL (MVP)
};

export type Assignment = {
  id: string;
  courseId: string;
  title: string;

  instructionsHtml: string;
  instructions?: string;

  fundamentals: string[];
  objectives: string[];

  tutorialUrl?: string;
  starterCode?: StarterAsset | null;
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

export type CourseProfile = {
  courseId: string;
  studentEmail: string;
  updatedAtISO: string;
  topics: string[];
  mastered: string[];
  developing: string[];
  notes: string;
};

type DB = {
  courses: Course[];
  assignments: Assignment[];
  enrollments: Enrollment[];
  submissions: Submission[];
  profiles: CourseProfile[]; // ✅ NEW
  seeded: boolean;
};

const KEY = "codecoach.mockdb.v1";

function empty(): DB {
  return {
    courses: [],
    assignments: [],
    enrollments: [],
    submissions: [],
    profiles: [],
    seeded: false,
  };
}

function load(): DB {
  if (typeof window === "undefined") return empty();
  const raw = localStorage.getItem(KEY);
  if (!raw) return empty();
  try {
    const parsed = JSON.parse(raw) as Partial<DB>;
    // Backwards compatible if old DB had no profiles:
    return {
      ...empty(),
      ...parsed,
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
    };
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

function uniq(arr: string[]) {
  return Array.from(new Set((arr || []).map((s) => (s ?? "").toString().trim()).filter(Boolean)));
}

function mergeProfile(oldP: CourseProfile, patch: Partial<CourseProfile>): CourseProfile {
  const mastered = uniq([...(oldP.mastered || []), ...((patch.mastered as string[]) || [])]);
  const developingRaw = uniq([...(oldP.developing || []), ...((patch.developing as string[]) || [])]);
  const developing = developingRaw.filter((x) => !mastered.includes(x));
  const topics = uniq([...(oldP.topics || []), ...((patch.topics as string[]) || [])]);

  return {
    ...oldP,
    updatedAtISO: new Date().toISOString(),
    mastered,
    developing,
    topics,
    notes: typeof patch.notes === "string" && patch.notes.trim() ? patch.notes : oldP.notes,
  };
}

function hasNewDemoSeed(db: DB) {
  const codes = new Set(db.courses.map((c) => c.joinCode));
  return codes.has("NU-CS336-101") && codes.has("NU-CS213-202") && codes.has("NU-GEN-303");
}

export function seedIfNeeded() {
  const db = load();
  if (db.seeded) return;

  db.courses = Array.isArray(db.courses) ? db.courses : [];
  db.assignments = Array.isArray(db.assignments) ? db.assignments : [];
  db.enrollments = Array.isArray(db.enrollments) ? db.enrollments : [];
  db.submissions = Array.isArray(db.submissions) ? db.submissions : [];
  db.profiles = Array.isArray((db as any).profiles) ? (db as any).profiles : [];

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

/* PROFILES */
export function getCourseProfile(courseId: string, studentEmail: string): CourseProfile {
  const db = load();
  const existing = db.profiles.find((p) => p.courseId === courseId && p.studentEmail === studentEmail);
  if (existing) return existing;

  const created: CourseProfile = {
    courseId,
    studentEmail,
    updatedAtISO: new Date().toISOString(),
    topics: [],
    mastered: [],
    developing: [],
    notes: "",
  };
  db.profiles.push(created);
  save(db);
  return created;
}

export function upsertCourseProfile(
  courseId: string,
  studentEmail: string,
  update: Partial<Pick<CourseProfile, "topics" | "mastered" | "developing" | "notes">>
) {
  const db = load();
  const idx = db.profiles.findIndex((p) => p.courseId === courseId && p.studentEmail === studentEmail);

  if (idx < 0) {
    const created: CourseProfile = {
      courseId,
      studentEmail,
      updatedAtISO: new Date().toISOString(),
      topics: uniq(update.topics || []),
      mastered: uniq(update.mastered || []),
      developing: uniq(update.developing || []),
      notes: (update.notes || "").toString(),
    };
    db.profiles.push(created);
    save(db);
    return created;
  }

  const merged = mergeProfile(db.profiles[idx], update as any);
  db.profiles[idx] = merged;
  save(db);
  return merged;
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

export function getSubmissionsForStudentInCourse(courseId: string, studentEmail: string) {
  const db = load();
  const assignmentIds = new Set(db.assignments.filter((a) => a.courseId === courseId).map((a) => a.id));
  return db.submissions.filter((s) => s.studentEmail === studentEmail && assignmentIds.has(s.assignmentId));
}

export function getSubmissionsForAssignment(assignmentId: string) {
  const db = load();
  return db.submissions.filter((s) => s.assignmentId === assignmentId);
}

export function createAssignment(
  courseId: string,
  payload: {
    title: string;
    instructionsHtml: string;
    fundamentals?: string[];
    objectives?: string[];
    tutorialUrl?: string;
    starterCode?: StarterAsset | null;
  }
) {
  const db = load();
  const c = db.courses.find((x) => x.id === courseId);
  if (!c) throw new Error("Course not found.");

  const a: Assignment = {
    id: uid("asmt"),
    courseId,
    title: payload.title.trim(),

    instructionsHtml: payload.instructionsHtml?.trim() || "<p></p>",
    // optional legacy fallback
    instructions: "",

    fundamentals: payload.fundamentals || [],
    objectives: payload.objectives || [],

    tutorialUrl: payload.tutorialUrl?.trim() || undefined,
    starterCode: payload.starterCode ?? null,
  };

  db.assignments.push(a);
  save(db);
  return a;
}

/* record a submission */
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

/* submission + optional profile update (what your student UI will call) */
export function upsertSubmissionWithProfile(input: {
  assignmentId: string;
  studentEmail: string;
  traceCount: number;
  summarySnippet: string;
  topics?: string[];
  mastered?: string[];
  developing?: string[];
  notes?: string;
}) {
  const a = getAssignment(input.assignmentId);

  const sub = upsertSubmission({
    assignmentId: input.assignmentId,
    studentEmail: input.studentEmail,
    traceCount: input.traceCount,
    summarySnippet: input.summarySnippet,
  });

  if (input.topics || input.mastered || input.developing || input.notes) {
    upsertCourseProfile(a.courseId, input.studentEmail, {
      topics: input.topics || [],
      mastered: input.mastered || [],
      developing: input.developing || [],
      notes: input.notes || "",
    });
  }

  return sub;
}