// codecoach-web/app/student/page.tsx
"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { getAuth } from "@/lib/storage";
import { getStudentCourses, joinCourseByCode, seedIfNeeded } from "@/lib/mockDb";
import { useRouter } from "next/navigation";

export default function StudentHome() {
  const router = useRouter();
  const auth = getAuth();
  const email = auth?.email ?? "";

  const [joinCode, setJoinCode] = useState("");
  const [courses, setCourses] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  function refresh() {
    seedIfNeeded();
    setCourses(getStudentCourses(email));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <RequireAuth>
      <AppShell title="My Classes">
        <div className="space-y-8">
          <section className="space-y-3">
            <div className="text-sm font-semibold">Join a class</div>
            <div className="grid gap-3">
              <input
                className="input"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Enter join code (e.g., NU-CS336-101)"
              />
              {err ? <div className="text-sm text-red-700">{err}</div> : null}
              <button
                className="btn-primary w-fit"
                onClick={() => {
                  setErr(null);
                  try {
                    if (!joinCode.trim()) throw new Error("Join code required.");
                    joinCourseByCode(email, joinCode);
                    setJoinCode("");
                    refresh();
                  } catch (e: any) {
                    setErr(e?.message ?? "Failed to join course.");
                  }
                }}
              >
                Join course
              </button>
              <div className="text-xs text-black/50">
                Demo codes: <span className="font-semibold">NU-CS336-101</span>,{" "}
                <span className="font-semibold">NU-CS213-202</span>,{" "}
                <span className="font-semibold">NU-GEN-303</span>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="text-sm font-semibold">Your enrolled classes</div>
            {courses.length === 0 ? (
              <div className="text-sm text-black/60">You’re not enrolled in any classes yet.</div>
            ) : (
              <div className="grid gap-3">
                {courses.map((c) => (
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