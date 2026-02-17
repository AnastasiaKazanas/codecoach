"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { getCourse, getRoster, getSubmissionsForCourse, seedIfNeeded } from "@/lib/mockDb";
import { useParams } from "next/navigation";

export default function InstructorCoursePage() {
  const params = useParams<{ courseId: string }>();
  const courseId = params?.courseId;

  const [course, setCourse] = useState<any>(null);
  const [roster, setRoster] = useState<string[]>([]);
  const [subs, setSubs] = useState<any[]>([]);

  useEffect(() => {
    if (!courseId) return;
    seedIfNeeded();
    setCourse(getCourse(courseId));
    setRoster(getRoster(courseId));
    setSubs(getSubmissionsForCourse(courseId));
  }, [courseId]);

  if (!courseId) return null;
  if (!course) return null;

  return (
    <RequireAuth>
      <AppShell title={course.title}>
        <div className="space-y-8">
          <div className="rounded-2xl border border-black/10 bg-white p-4">
            <div className="text-sm font-semibold">Join code</div>
            <div className="mt-2 flex items-center gap-3">
              <code className="rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-sm">
                {course.joinCode}
              </code>
              <button
                className="btn-secondary"
                onClick={() => navigator.clipboard.writeText(course.joinCode)}
              >
                Copy
              </button>
            </div>
          </div>

          <section className="space-y-2">
            <div className="text-sm font-semibold">Students</div>
            {roster.length === 0 ? (
              <div className="text-sm text-black/60">No students yet.</div>
            ) : (
              <div className="grid gap-2">
                {roster.map((s) => (
                  <div
                    key={s}
                    className="rounded-2xl border border-black/10 bg-white p-3 text-sm"
                  >
                    {s}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <div className="text-sm font-semibold">Student work (learning traces)</div>
            {subs.length === 0 ? (
              <div className="text-sm text-black/60">
                No submissions yet. Students will submit traces + summaries from the VS Code extension.
              </div>
            ) : (
              <div className="grid gap-2">
                {subs.map((x) => (
                  <div
                    key={x.assignmentId + x.studentEmail}
                    className="rounded-2xl border border-black/10 bg-white p-3 text-sm"
                  >
                    <div className="font-semibold">{x.studentEmail}</div>
                    <div className="text-black/60">
                      {x.submittedAtISO} • events: {x.traceCount}
                    </div>
                    <div className="mt-1">{x.summarySnippet}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </AppShell>
    </RequireAuth>
  );
}