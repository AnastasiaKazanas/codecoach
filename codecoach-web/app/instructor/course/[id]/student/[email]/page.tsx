"use client";

import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getCourse,
  getCourseProfile,
  getSubmissionsForStudentInCourse,
  seedIfNeeded,
} from "@/lib/mockDb";

export default function InstructorStudentPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;
  const studentEmail = decodeURIComponent(params.email as string);

  const [course, setCourse] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [subs, setSubs] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  function refresh() {
    try {
      seedIfNeeded();
      setCourse(getCourse(courseId));
      setProfile(getCourseProfile(courseId, studentEmail));
      setSubs(getSubmissionsForStudentInCourse(courseId, studentEmail));
      setErr(null);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load student.");
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, studentEmail]);

  return (
    <RequireAuth>
      <AppShell title="Student Performance">
        {err ? <div className="text-sm text-red-700">{err}</div> : null}

        {course && profile ? (
          <div className="space-y-6">
            <div className="card p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xl font-bold">{studentEmail}</div>
                  <div className="mt-1 text-sm text-black/60">
                    Course: {course.title} • Last updated:{" "}
                    {new Date(profile.updatedAtISO).toLocaleString()}
                  </div>
                </div>

                <button
                  className="px-3 py-2 rounded-xl border border-black/10 hover:bg-black/5 transition text-sm"
                  onClick={() => router.push(`/instructor/course/${courseId}`)}
                >
                  Back to course
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="card p-4">
                <div className="text-sm font-semibold">Mastered</div>
                {profile.mastered?.length ? (
                  <ul className="mt-2 text-sm list-disc ml-5">
                    {profile.mastered.map((x: string) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-2 text-sm text-black/60">None yet.</div>
                )}
              </div>

              <div className="card p-4">
                <div className="text-sm font-semibold">Developing</div>
                {profile.developing?.length ? (
                  <ul className="mt-2 text-sm list-disc ml-5">
                    {profile.developing.map((x: string) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-2 text-sm text-black/60">None yet.</div>
                )}
              </div>
            </div>

            <div className="card p-4">
              <div className="text-sm font-semibold">Topics</div>
              <div className="mt-2 text-sm text-black/70">
                {profile.topics?.length ? profile.topics.join(", ") : "None yet."}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold">Submissions</div>
              {subs.length === 0 ? (
                <div className="text-sm text-black/60">No submissions yet.</div>
              ) : (
                <div className="grid gap-3">
                  {subs.map((s) => (
                    <div key={`${s.assignmentId}-${s.studentEmail}`} className="card p-4">
                      <div className="text-sm font-semibold">
                        Assignment: {s.assignmentId}
                      </div>
                      <div className="text-xs text-black/60">
                        {new Date(s.submittedAtISO).toLocaleString()} • Trace: {s.traceCount}
                      </div>
                      <div className="mt-2 text-sm text-black/70 whitespace-pre-wrap">
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