import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import Database from "better-sqlite3";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 4002;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

const db = new Database(new URL("../codecoach.db", import.meta.url).pathname);
db.exec(`
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  instructorId TEXT NOT NULL,
  title TEXT NOT NULL,
  joinCode TEXT NOT NULL,
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

function makeJoinCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// Create course (instructor)
app.post("/courses", requireAuth, (req, res) => {
  if (req.user.role !== "instructor") return res.status(403).json({ error: "instructor only" });

  const { title } = req.body || {};
  if (!title) return res.status(400).json({ error: "title required" });

  const id = makeId("c");
  const joinCode = makeJoinCode();
  const now = new Date().toISOString();

  db.prepare(
    "INSERT INTO courses (id, instructorId, title, joinCode, createdAtISO) VALUES (?, ?, ?, ?, ?)"
  ).run(id, req.user.sub, title, joinCode, now);

  // auto-enroll instructor
  db.prepare(
    "INSERT INTO enrollments (courseId, userId, roleInCourse, createdAtISO) VALUES (?, ?, ?, ?)"
  ).run(id, req.user.sub, "instructor", now);

  res.json({ id, title, joinCode });
});

// Join course (student)
app.post("/courses/join", requireAuth, (req, res) => {
  const { joinCode } = req.body || {};
  if (!joinCode) return res.status(400).json({ error: "joinCode required" });

  const course = db.prepare("SELECT * FROM courses WHERE joinCode = ?").get(joinCode);
  if (!course) return res.status(404).json({ error: "course not found" });

  const now = new Date().toISOString();
  db.prepare(
    "INSERT OR IGNORE INTO enrollments (courseId, userId, roleInCourse, createdAtISO) VALUES (?, ?, ?, ?)"
  ).run(course.id, req.user.sub, "student", now);

  res.json({ ok: true, courseId: course.id, title: course.title });
});

// List my courses
app.get("/me/courses", requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT c.id, c.title, c.joinCode, e.roleInCourse
    FROM enrollments e
    JOIN courses c ON c.id = e.courseId
    WHERE e.userId = ?
    ORDER BY c.createdAtISO DESC
  `).all(req.user.sub);

  res.json({ courses: rows });
});

app.listen(PORT, () => console.log(`api-courses running on http://localhost:${PORT}`));