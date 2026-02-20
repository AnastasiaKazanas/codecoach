"use client";

import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getAuth } from "@/lib/storage";
import { joinCourse, getStudentCourses } from "@/lib/db"; 
import { useRouter } from "next/navigation";

export default function StudentHome() {
  const [email, setEmail] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [courses, setCourses] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function refresh(em: string) {
    const list = await getStudentCourses(em);
    setCourses(list ?? []);
  }

  useEffect(() => {
    async function load() {
      setErr(null);
      const user = await getAuth();
      const em = user?.email ?? "";
      setEmail(em);
      if (em) await refresh(em);
    }
    load();
  }, []);

  return (
    <RequireAuth>
      <AppShell title="My Courses">
        {err ? <div className="text-sm text-red-700">{err}</div> : null}

        <div className="space-y-6">
          <div className="card p-6 space-y-3">
            <div className="text-sm font-semibold">Join a course</div>
            <input
              className="input"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Enter join code"
            />
            <button
              className="btn-primary w-fit"
              onClick={async () => {
                try {
                  setErr(null);
                  if (!joinCode.trim()) throw new Error("Join code required.");
                  await joinCourse({ join_code: joinCode.trim(), student_email: email }); // map to your schema
                  setJoinCode("");
                  await refresh(email);
                } catch (e: any) {
                  setErr(e?.message ?? "Failed to join course.");
                }
              }}
            >
              Join
            </button>
          </div>

          <div className="card p-6">
            <div className="text-sm font-semibold mb-3">Enrolled courses</div>
            {courses.length === 0 ? (
              <div className="text-sm text-black/60">No courses yet.</div>
            ) : (
              <div className="grid gap-3">
            {courses.map((c) => (
              <button
                key={c.id}
                type="button"
                className="w-full text-left rounded-2xl border border-black/10 bg-white p-4 hover:bg-black/5 transition"
                onClick={() => router.push(`/student/course/${c.id}`)}
              >
                <div className="text-base font-bold">{c.title}</div>
                <div className="text-sm text-black/60">{c.term}</div>
              </button>
            ))}
              </div>
            )}
          </div>
        </div>
      </AppShell>
    </RequireAuth>
  );
}