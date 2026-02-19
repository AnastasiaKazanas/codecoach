// codecoach-web/app/instructor/course/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { useParams } from "next/navigation";
import {
  getCourse,
  getCourseAssignments,
  getRoster,
  getSubmissionsForCourse,
  seedIfNeeded,
} from "@/lib/mockDb";

export default function InstructorCoursePage() {
  const params = useParams();
  const courseId = params.id as string;

  const [course, setCourse] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [roster, setRoster] = useState<string[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  function refresh() {
    try {
      seedIfNeeded();
      setCourse(getCourse(courseId));
      setAssignments(getCourseAssignments(courseId));
      setRoster(getRoster(courseId));
      setSubmissions(getSubmissionsForCourse(courseId));
      setErr(null);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load course.");
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                {course.term} • Join code: <span className="font-semibold">{course.joinCode}</span>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="card p-4">
                <div className="text-sm font-semibold">Roster</div>
                {roster.length === 0 ? (
                  <div className="mt-2 text-sm text-black/60">No students enrolled yet.</div>
                ) : (
                  <ul className="mt-2 text-sm list-disc ml-5">
                    {roster.map((email) => (
                      <li key={email}>{email}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="card p-4">
                <div className="text-sm font-semibold">Submissions</div>
                {submissions.length === 0 ? (
                  <div className="mt-2 text-sm text-black/60">No submissions yet.</div>
                ) : (
                  <div className="mt-2 grid gap-2 text-sm">
                    {submissions.map((s) => (
                      <div key={`${s.assignmentId}-${s.studentEmail}`} className="rounded-xl border border-black/10 p-3">
                        <div className="font-semibold">{s.studentEmail}</div>
                        <div className="text-black/60 text-xs">
                          Assignment: {s.assignmentId} • {new Date(s.submittedAtISO).toLocaleString()}
                        </div>
                        <div className="mt-2 text-xs text-black/70">
                          Trace events: {s.traceCount} • Summary: {s.summarySnippet || "(none)"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
                        <span className="font-semibold">Fundamentals:</span> {a.fundamentals.join(", ")}
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