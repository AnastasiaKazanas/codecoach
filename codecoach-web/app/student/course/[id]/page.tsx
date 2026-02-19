// codecoach-web/app/student/course/[id]/page.tsx
"use client";

import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { getCourse, getCourseAssignments, seedIfNeeded } from "@/lib/mockDb";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function StudentCoursePage() {
  const params = useParams();
  const courseId = params.id as string;

  const [course, setCourse] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    try {
      seedIfNeeded();
      setCourse(getCourse(courseId));
      setAssignments(getCourseAssignments(courseId));
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load course.");
    }
  }, [courseId]);

  return (
    <RequireAuth>
      <AppShell title="Class">
        {err ? <div className="text-sm text-red-700">{err}</div> : null}

        {course ? (
          <div className="space-y-6">
            <div className="card p-6">
              <div className="text-xl font-bold">{course.title}</div>
              <div className="mt-1 text-sm text-black/60">{course.term}</div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold">Assignments</div>
              {assignments.length === 0 ? (
                <div className="text-sm text-black/60">No assignments yet.</div>
              ) : (
                <div className="grid gap-3">
                  {assignments.map((a) => (
                    <div key={a.id} className="card p-4">
                      <div className="text-base font-bold">{a.title}</div>
                      <div className="mt-2 text-sm text-black/70 whitespace-pre-wrap">{a.instructions}</div>

                      <div className="mt-3 text-xs text-black/60">
                        <div className="font-semibold">Objectives</div>
                        <ul className="list-disc ml-5">
                          {a.objectives.map((x: string) => (
                            <li key={x}>{x}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="mt-3 text-xs text-black/60">
                        <div className="font-semibold">Fundamentals</div>
                        <div>{a.fundamentals.join(", ")}</div>
                      </div>
                    </div>
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