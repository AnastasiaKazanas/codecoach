import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import Database from "better-sqlite3";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 4001;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

const db = new Database(new URL("../codecoach.db", import.meta.url).pathname);
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL
);
`);

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
}

// MVP login: no password, just email + role.
// In demo/web, you’d restrict role selection and do real auth later.
app.post("/auth/login", (req, res) => {
  const { email, role } = req.body || {};
  if (!email || !role) return res.status(400).json({ error: "email and role required" });
  if (!["student", "instructor"].includes(role)) return res.status(400).json({ error: "invalid role" });

  const existing = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  let user = existing;

  if (!user) {
    const id = `u_${Math.random().toString(16).slice(2)}`;
    db.prepare("INSERT INTO users (id, email, role) VALUES (?, ?, ?)").run(id, email, role);
    user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  }

  const token = signToken(user);
  res.json({ token, user });
});

// Simple “whoami”
app.get("/me", (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "missing token" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ me: decoded });
  } catch {
    res.status(401).json({ error: "invalid token" });
  }
});

app.listen(PORT, () => console.log(`auth-api running on http://localhost:${PORT}`));