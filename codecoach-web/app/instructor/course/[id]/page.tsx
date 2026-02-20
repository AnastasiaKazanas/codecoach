"use client";

import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCourse, seedIfNeeded } from "@/lib/db";

export default function InstructorCourseHubPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  const [course, setCourse] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const c = await getCourse(courseId);
      setCourse(c);
    }
    load();
  }, [courseId]);

  return (
    <RequireAuth>
      <AppShell title="Course">
        {err ? <div className="text-sm text-red-700">{err}</div> : null}

        {course ? (
          <div className="space-y-6">
            <div className="card p-6">
              <div className="text-xl font-bold">{course.title}</div>
              <div className="mt-1 text-sm text-black/60">
                {course.term} • Join code: <span className="font-semibold">{course.join_code ?? "—"}</span>
                <span className="font-semibold">{course.joinCode}</span>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <button
                className="card p-5 text-left hover:bg-black/5 transition"
                onClick={() => router.push(`/instructor/course/${courseId}/roster`)}
              >
                <div className="text-sm font-semibold">Roster</div>
                <div className="mt-1 text-sm text-black/60">
                  View students and their class profiles
                </div>
              </button>

              <button
                className="card p-5 text-left hover:bg-black/5 transition"
                onClick={() => router.push(`/instructor/course/${courseId}/assignments`)}
              >
                <div className="text-sm font-semibold">Assignments</div>
                <div className="mt-1 text-sm text-black/60">
                  View active assignments and submissions
                </div>
              </button>

              <button
                className="card p-5 text-left hover:bg-black/5 transition"
                onClick={() => router.push(`/instructor/course/${courseId}/assignments/new`)}
              >
                <div className="text-sm font-semibold">Create assignment</div>
                <div className="mt-1 text-sm text-black/60">
                  Add a new assignment to this course
                </div>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-black/60">Loading…</div>
        )}
      </AppShell>
    </RequireAuth>
  );
}