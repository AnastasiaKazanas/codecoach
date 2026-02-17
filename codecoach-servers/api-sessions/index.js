import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import Database from "better-sqlite3";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 4003;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

const db = new Database(new URL("../codecoach.db", import.meta.url).pathname);
db.exec(`
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  assignmentId TEXT NOT NULL,
  studentId TEXT NOT NULL,
  status TEXT NOT NULL,
  createdAtISO TEXT NOT NULL,
  submittedAtISO TEXT
);

CREATE TABLE IF NOT EXISTS trace_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId TEXT NOT NULL,
  type TEXT NOT NULL,
  ts TEXT NOT NULL,
  payloadJson TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  courseId TEXT NOT NULL,
  title TEXT NOT NULL,
  instructions TEXT NOT NULL,
  fundamentalsJson TEXT NOT NULL,
  objectivesJson TEXT NOT NULL,
  createdAtISO TEXT NOT NULL
);

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

function isEnrolledInAssignment(db, userId, assignmentId) {
  const a = db.prepare("SELECT courseId FROM assignments WHERE id = ?").get(assignmentId);
  if (!a) return { ok: false, error: "assignment not found" };
  const enrolled = db.prepare("SELECT 1 FROM enrollments WHERE userId = ? AND courseId = ?").get(userId, a.courseId);
  if (!enrolled) return { ok: false, error: "not enrolled in course" };
  return { ok: true, courseId: a.courseId };
}

// Student: start session
app.post("/sessions/start", requireAuth, (req, res) => {
  const { assignmentId } = req.body || {};
  if (!assignmentId) return res.status(400).json({ error: "assignmentId required" });

  const check = isEnrolledInAssignment(db, req.user.sub, assignmentId);
  if (!check.ok) return res.status(403).json({ error: check.error });

  const sessionId = makeId("s");
  db.prepare(`
    INSERT INTO sessions (id, assignmentId, studentId, status, createdAtISO)
    VALUES (?, ?, ?, ?, ?)
  `).run(sessionId, assignmentId, req.user.sub, "in_progress", new Date().toISOString());

  res.json({ sessionId });
});

// Student: append trace events
app.post("/sessions/:sessionId/events", requireAuth, (req, res) => {
  const { events } = req.body || {};
  if (!Array.isArray(events)) return res.status(400).json({ error: "events must be an array" });

  const s = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.sessionId);
  if (!s) return res.status(404).json({ error: "session not found" });
  if (s.studentId !== req.user.sub) return res.status(403).json({ error: "not your session" });

  const stmt = db.prepare(`
    INSERT INTO trace_events (sessionId, type, ts, payloadJson)
    VALUES (?, ?, ?, ?)
  `);

  const insertMany = db.transaction((rows) => {
    for (const e of rows) {
      stmt.run(req.params.sessionId, e.type, e.ts, JSON.stringify(e.payload || {}));
    }
  });

  insertMany(events);
  res.json({ ok: true, inserted: events.length });
});

// Student: submit session (marks submitted)
app.post("/sessions/:sessionId/submit", requireAuth, (req, res) => {
  const s = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.sessionId);
  if (!s) return res.status(404).json({ error: "session not found" });
  if (s.studentId !== req.user.sub) return res.status(403).json({ error: "not your session" });

  db.prepare("UPDATE sessions SET status = ?, submittedAtISO = ? WHERE id = ?")
    .run("submitted", new Date().toISOString(), req.params.sessionId);

  res.json({ ok: true });
});

// Instructor: view sessions for an assignment
app.get("/instructor/assignments/:assignmentId/sessions", requireAuth, (req, res) => {
  if (req.user.role !== "instructor") return res.status(403).json({ error: "instructor only" });

  const a = db.prepare("SELECT * FROM assignments WHERE id = ?").get(req.params.assignmentId);
  if (!a) return res.status(404).json({ error: "assignment not found" });

  const course = db.prepare("SELECT * FROM courses WHERE id = ?").get(a.courseId);
  if (!course || course.instructorId !== req.user.sub) {
    return res.status(403).json({ error: "not your course" });
  }

  const rows = db.prepare(`
    SELECT id, studentId, status, createdAtISO, submittedAtISO
    FROM sessions
    WHERE assignmentId = ?
    ORDER BY createdAtISO DESC
  `).all(req.params.assignmentId);

  res.json({ sessions: rows });
});

// Instructor: view trace for a session
app.get("/instructor/sessions/:sessionId/trace", requireAuth, (req, res) => {
  if (req.user.role !== "instructor") return res.status(403).json({ error: "instructor only" });

  const s = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.sessionId);
  if (!s) return res.status(404).json({ error: "session not found" });

  const a = db.prepare("SELECT * FROM assignments WHERE id = ?").get(s.assignmentId);
  if (!a) return res.status(404).json({ error: "assignment missing" });

  const course = db.prepare("SELECT * FROM courses WHERE id = ?").get(a.courseId);
  if (!course || course.instructorId !== req.user.sub) {
    return res.status(403).json({ error: "not your course" });
  }

  const events = db.prepare(`
    SELECT type, ts, payloadJson
    FROM trace_events
    WHERE sessionId = ?
    ORDER BY id ASC
  `).all(req.params.sessionId);

  res.json({
    session: { id: s.id, assignmentId: s.assignmentId, studentId: s.studentId, status: s.status },
    events: events.map((e) => ({ type: e.type, ts: e.ts, payload: JSON.parse(e.payloadJson || "{}") }))
  });
});

app.listen(PORT, () => console.log(`api-sessions running on http://localhost:${PORT}`));