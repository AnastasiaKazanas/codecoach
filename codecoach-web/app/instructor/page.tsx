"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { getAuth } from "@/lib/storage";
import { createCourse, getInstructorCourses, seedIfNeeded } from "@/lib/mockDb";
import { useRouter } from "next/navigation";

export default function InstructorHome() {
  const router = useRouter();
  const auth = getAuth();
  const email = auth?.email ?? "";

  const [title, setTitle] = useState("CS 348 — AI");
  const [term, setTerm] = useState("Spring 2026");
  const [courses, setCourses] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  function refresh() {
    seedIfNeeded();
    setCourses(getInstructorCourses(email));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <RequireAuth>
      <AppShell title="My Courses">
        <div className="space-y-8">
          <section className="space-y-3">
            <div className="text-sm font-semibold">Create a course</div>
            <div className="grid gap-3">
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Course title" />
              <input className="input" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Term" />
              {err ? <div className="text-sm text-red-700">{err}</div> : null}
              <button
                className="btn-primary w-fit"
                onClick={() => {
                  setErr(null);
                  try {
                    if (!title.trim() || !term.trim()) throw new Error("Title and term required.");
                    createCourse(email, title, term);
                    refresh();
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
                      {c.term} • Join code: <span className="font-semibold">{c.joinCode}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </AppShell>
    </RequireAuth>
  );
}