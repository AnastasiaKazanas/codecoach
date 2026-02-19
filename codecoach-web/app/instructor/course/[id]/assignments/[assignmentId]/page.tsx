"use client";

import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getAssignment,
  getCourse,
  getSubmissionsForAssignment,
  seedIfNeeded,
} from "@/lib/mockDb";

export default function InstructorAssignmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  // IMPORTANT: decode so ids like "asmt_..." work even if encoded
  const assignmentId = decodeURIComponent(params.assignmentId as string);

  const [course, setCourse] = useState<any>(null);
  const [asmt, setAsmt] = useState<any>(null);
  const [subs, setSubs] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    try {
      seedIfNeeded();
      setCourse(getCourse(courseId));
      setAsmt(getAssignment(assignmentId));
      setSubs(getSubmissionsForAssignment(assignmentId));
      setErr(null);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load assignment.");
    }
  }, [courseId, assignmentId]);

  return (
    <RequireAuth>
      <AppShell title="Assignment">
        {err ? <div className="text-sm text-red-700">{err}</div> : null}

        {course && asmt ? (
          <div className="space-y-6">
            <div className="card p-6">
              <div className="text-xl font-bold">{asmt.title}</div>
              <div className="mt-1 text-sm text-black/60">{course.title}</div>

              <div className="mt-4 flex gap-2">
                <button
                  className="px-3 py-2 rounded-xl border border-black/10 hover:bg-black/5 transition"
                  onClick={() =>
                    router.push(`/instructor/course/${courseId}/assignments`)
                  }
                >
                  Back to assignments
                </button>
              </div>
            </div>

            <div className="card p-6">
              <div className="text-sm font-semibold mb-2">Description</div>

              <div className="rounded-2xl border border-black/10 bg-white p-4 sm:p-6 overflow-x-auto">
                <div
                  className="prose max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: asmt.instructionsHtml || asmt.instructions || "",
                  }}
                />
              </div>

              {asmt.tutorialUrl ? (
                <div className="mt-4 text-sm">
                  Tutorial:{" "}
                  <a
                    className="underline"
                    href={asmt.tutorialUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {asmt.tutorialUrl}
                  </a>
                </div>
              ) : null}

              {asmt.starterCode?.dataUrl ? (
                <div className="mt-2 text-sm">
                  Starter code:{" "}
                  <a
                    className="underline"
                    href={asmt.starterCode.dataUrl}
                    download={asmt.starterCode.filename}
                  >
                    Download {asmt.starterCode.filename}
                  </a>
                </div>
              ) : null}
            </div>

            <div className="card p-6">
              <div className="text-sm font-semibold">Submissions</div>
              {subs.length === 0 ? (
                <div className="mt-2 text-sm text-black/60">
                  No submissions yet.
                </div>
              ) : (
                <div className="mt-3 grid gap-2">
                  {subs.map((s) => (
                    <div
                      key={`${s.assignmentId}-${s.studentEmail}`}
                      className="rounded-xl border border-black/10 p-3"
                    >
                      <div className="font-semibold">{s.studentEmail}</div>
                      <div className="text-xs text-black/60">
                        {new Date(s.submittedAtISO).toLocaleString()}
                      </div>
                      <div className="mt-1 text-xs text-black/70">
                        Trace: {s.traceCount} •{" "}
                        {s.summarySnippet || "(no snippet)"}
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