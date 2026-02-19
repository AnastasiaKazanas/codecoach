"use client";

import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCourse, getCourseAssignments, seedIfNeeded } from "@/lib/mockDb";

export default function StudentCoursePage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  const [course, setCourse] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    try {
      seedIfNeeded();
      setCourse(getCourse(courseId));
      setAssignments(getCourseAssignments(courseId));
      setErr(null);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load course.");
    }
  }, [courseId]);

  return (
    <RequireAuth>
      <AppShell title="Course">
        {err ? <div className="text-sm text-red-700">{err}</div> : null}

        {course ? (
          <div className="space-y-6">
            <div className="card p-6">
              <div className="text-xl font-bold">{course.title}</div>
              <div className="mt-1 text-sm text-black/60">{course.term}</div>

              <div className="mt-4">
                <button
                  className="px-3 py-2 rounded-xl border border-black/10 hover:bg-black/5 transition"
                  onClick={() => router.push(`/student/course/${courseId}/profile`)}
                >
                  View course profile
                </button>
              </div>
            </div>

            <div className="card p-6">
              <div className="text-sm font-semibold mb-3">Assignments</div>

              {assignments.length === 0 ? (
                <div className="text-sm text-black/60">No assignments yet.</div>
              ) : (
                <div className="grid gap-3">
                  {assignments.map((a) => (
                    <button
                      key={a.id}
                      className="w-full text-left rounded-2xl border border-black/10 bg-white p-4 hover:bg-black/5 transition"
                      onClick={() =>
                        router.push(
                          `/student/course/${courseId}/assignments/${encodeURIComponent(a.id)}`
                        )
                      }
                    >
                      <div className="text-base font-bold">{a.title}</div>
                      <div className="text-xs text-black/60 mt-1">
                        {a.tutorialUrl ? "Has tutorial link" : "No tutorial"} •{" "}
                        {a.starterCode ? "Has starter code" : "No starter code"}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-sm text-black/60">Loading…</div>
        )}
      </AppShell>
    </RequireAuth>
  );
}