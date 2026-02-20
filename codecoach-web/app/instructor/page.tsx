"use client";

import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ensureAppUser, createCourse, getInstructorCourses } from "@/lib/mockDb";

export default function InstructorHome() {
  const router = useRouter();

  const [instructorId, setInstructorId] = useState<string>("");
  const [email, setEmail] = useState("");
  const [courses, setCourses] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [title, setTitle] = useState("CS 110: Intro to Computer Programming with Python");
  const [term, setTerm] = useState("Spring 2026");

  const refresh = async (id: string) => {
    const list = await getInstructorCourses(id);
    setCourses(list ?? []);
  };

  useEffect(() => {
    async function load() {
      try {
        setErr(null);

        // Force role = instructor for all /app/instructor/** pages
        const u = await ensureAppUser("instructor");
        setInstructorId(u.id);
        setEmail(u.email);

        await refresh(u.id);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load instructor data.");
      }
    }
    load();
  }, []);

  return (
    <RequireAuth>
      <AppShell title="My Courses">
        <div className="space-y-8">
          {err ? <div className="text-sm text-red-700">{err}</div> : null}

          <section className="space-y-3">
            <div className="text-sm font-semibold">Create a course</div>
            <div className="grid gap-3">
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Course title" />
              <input className="input" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Term" />

              <button
                className="btn-primary w-fit"
                onClick={async () => {
                  try {
                    setErr(null);
                    if (!instructorId) throw new Error("Not signed in.");
                    if (!title.trim() || !term.trim()) throw new Error("Title and term required.");

                    await createCourse({ title: title.trim(), term: term.trim(), instructor_id: instructorId });
                    await refresh(instructorId);
                  } catch (e: any) {
                    setErr(e?.message ?? "Failed to create course.");
                  }
                }}
              >
                Create course
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <div className="text-sm font-semibold">Courses you own</div>
            {courses.length === 0 ? (
              <div className="text-sm text-black/60">No courses yet.</div>
            ) : (
              <div className="grid gap-3">
                {courses.map((c) => (
                  <button
                    key={c.id}
                    className="w-full text-left rounded-2xl border border-black/10 bg-white p-4 hover:bg-black/5 transition"
                    onClick={() => router.push(`/instructor/course/${c.id}`)}
                  >
                    <div className="text-base font-bold">{c.title}</div>
                    <div className="text-sm text-black/60">
                      {c.term} • Join code: <span className="font-semibold">{c.join_code}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <div className="text-xs text-black/40">Signed in as: {email || "—"}</div>
        </div>
      </AppShell>
    </RequireAuth>
  );
}