import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import Database from "better-sqlite3";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 4004; // assignments is separate from courses
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

const db = new Database(new URL("../codecoach.db", import.meta.url).pathname);
db.exec(`
CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  courseId TEXT NOT NULL,
  title TEXT NOT NULL,
  instructions TEXT NOT NULL,
  fundamentalsJson TEXT NOT NULL,
  objectivesJson TEXT NOT NULL,
  createdAtISO TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS enrollments (
  courseId TEXT NOT NULL,
  userId TEXT NOT NULL,
  roleInCourse TEXT NOT NULL,
  createdAtISO TEXT NOT NULL,
  PRIMARY KEY (courseId, userId)
);
`);

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "missing token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "invalid token" });
  }
}

function makeId(prefix) {
  return `${prefix}_${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
}

function isEnrolled(db, userId, courseId) {
  return !!db.prepare("SELECT 1 FROM enrollments WHERE userId = ? AND courseId = ?").get(userId, courseId);
}

function isInstructorInCourse(db, userId, courseId) {
  const row = db.prepare("SELECT roleInCourse FROM enrollments WHERE userId = ? AND courseId = ?").get(userId, courseId);
  return row?.roleInCourse === "instructor";
}

// Create assignment (instructor)
app.post("/assignments", requireAuth, (req, res) => {
  const { courseId, title, instructions, fundamentals, objectives } = req.body || {};
  if (!courseId || !title || !instructions) {
    return res.status(400).json({ error: "courseId, title, instructions required" });
  }

  if (!isInstructorInCourse(db, req.user.sub, courseId)) {
    return res.status(403).json({ error: "must be instructor in this course" });
  }

  const id = makeId("a");
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO assignments (id, courseId, title, instructions, fundamentalsJson, objectivesJson, createdAtISO)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    courseId,
    title,
    instructions,
    JSON.stringify(fundamentals || []),
    JSON.stringify(objectives || []),
    now
  );

  res.json({ id });
});

// List assignments for a course (enrolled users)
app.get("/courses/:courseId/assignments", requireAuth, (req, res) => {
  const { courseId } = req.params;
  if (!isEnrolled(db, req.user.sub, courseId)) {
    return res.status(403).json({ error: "not enrolled in course" });
  }

  const rows = db.prepare(`
    SELECT id, courseId, title, createdAtISO
    FROM assignments
    WHERE courseId = ?
    ORDER BY createdAtISO DESC
  `).all(courseId);

  res.json({ assignments: rows });
});

// Get assignment details (enrolled users)
app.get("/assignments/:assignmentId", requireAuth, (req, res) => {
  const a = db.prepare("SELECT * FROM assignments WHERE id = ?").get(req.params.assignmentId);
  if (!a) return res.status(404).json({ error: "assignment not found" });

  if (!isEnrolled(db, req.user.sub, a.courseId)) {
    return res.status(403).json({ error: "not enrolled in course" });
  }

  res.json({
    id: a.id,
    courseId: a.courseId,
    title: a.title,
    instructions: a.instructions,
    fundamentals: JSON.parse(a.fundamentalsJson || "[]"),
    objectives: JSON.parse(a.objectivesJson || "[]")
  });
});

app.listen(PORT, () => console.log(`api-assignments running on http://localhost:${PORT}`));