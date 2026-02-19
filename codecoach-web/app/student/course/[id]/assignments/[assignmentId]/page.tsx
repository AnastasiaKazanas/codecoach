"use client";

import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAssignment, getCourse, seedIfNeeded } from "@/lib/mockDb";

export default function StudentAssignmentDetailPage() {
  const params = useParams();
  const router = useRouter();

  const courseId = params.id as string;
  const assignmentId = decodeURIComponent(params.assignmentId as string);

  const [course, setCourse] = useState<any>(null);
  const [asmt, setAsmt] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    try {
      seedIfNeeded();
      setCourse(getCourse(courseId));
      setAsmt(getAssignment(assignmentId));
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

              <div className="mt-4">
                <button
                  className="px-3 py-2 rounded-xl border border-black/10 hover:bg-black/5 transition"
                  onClick={() => router.push(`/student/course/${courseId}`)}
                >
                  Back to class
                </button>
              </div>
            </div>

            <div className="card p-6">
              <div className="text-sm font-semibold mb-2">Instructions</div>

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
          </div>
        ) : (
          <div className="text-sm text-black/60">Loading…</div>
        )}
      </AppShell>
    </RequireAuth>
  );
}