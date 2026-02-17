"use client";

import { useEffect, useMemo, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { getAuth } from "@/lib/storage";
import { seedIfNeeded, getStudentCourses, joinCourseByCode } from "@/lib/mockDb";
import { useRouter } from "next/navigation";

export default function StudentHome() {
  const router = useRouter();
  const auth = getAuth();
  const email = auth?.email ?? "";

  const [joinCode, setJoinCode] = useState("NU-CS-101");
  const [err, setErr] = useState<string | null>(null);
  const [courses, setCourses] = useState(() => []);

  function refresh() {
    try {
      seedIfNeeded();
      setCourses(getStudentCourses(email) as any);
    } catch (e: any) {
      setErr(e?.message ?? "Something went wrong.");
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hint = useMemo(() => `Try join code: NU-CS-101`, []);

  return (
    <RequireAuth>
      <AppShell title="My Courses">
        <div className="space-y-8">
          <section className="space-y-3">
            <div>
              <div className="text-sm font-semibold">Join a course</div>
              <div className="text-sm text-black/60">{hint}</div>
            </div>

            <div className="flex gap-3">
              <input
                className="input"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Enter join code"
              />
              <button
                className="btn-primary"
                onClick={() => {
                  setErr(null);
                  try {
                    joinCourseByCode(email, joinCode);
                    refresh();
                  } catch (e: any) {
                    setErr(e?.message ?? "Failed to join.");
                  }
                }}
              >
                Join
              </button>
            </div>

            {err ? <div className="text-sm text-red-700">{err}</div> : null}
          </section>

          <section className="space-y-3">
            <div className="text-sm font-semibold">Your courses</div>

            {courses.length === 0 ? (
              <div className="text-sm text-black/60">No courses yet.</div>
            ) : (
              <div className="grid gap-3">
                {(courses as any[]).map((c) => (
                  <button
                    key={c.id}
                    className="w-full text-left rounded-2xl border border-black/10 bg-white p-4 hover:bg-black/5 transition"
                    onClick={() => router.push(`/student/course/${c.id}`)}
                  >
                    <div className="text-base font-bold">{c.title}</div>
                    <div className="text-sm text-black/60">{c.term}</div>
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