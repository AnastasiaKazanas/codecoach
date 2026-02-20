"use client";

import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { getCurrentUser, getCourse } from "@/lib/db";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function StudentCourseProfilePage() {
  const params = useParams();
  const router = useRouter();

  const courseId = params.id as string;

  const [course, setCourse] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [subs, setSubs] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);


  useEffect(() => {
    async function load() {
      const user = await getCurrentUser();
      if (!user?.email) return;

      const courseData = await getCourse(courseId);
      setCourse(courseData);
    }

    load();
  }, [courseId]);

  return (
    <RequireAuth>
      <AppShell title="Course Profile">
        {err ? <div className="text-sm text-red-700">{err}</div> : null}

        {course && profile ? (
          <div className="space-y-6">
            {/* ✅ Header card + Back button lives here */}
            <div className="card p-6">
              <div className="text-xl font-bold">{course.title}</div>

              <div className="mt-1 text-sm text-black/60">
                {course.term} • Last updated:{" "}
                {new Date(profile.updatedAtISO).toLocaleString()}
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="px-3 py-2 rounded-xl border border-black/10 hover:bg-black/5 transition"
                  onClick={() => router.push(`/student/course/${courseId}`)}
                >
                  Back to class
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="card p-4">
                <div className="text-sm font-semibold">Fundamentals mastered</div>
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
                <div className="text-sm font-semibold">Fundamentals developing</div>
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
              <div className="text-sm font-semibold">Topics covered</div>
              <div className="mt-2 text-sm text-black/70">
                {profile.topics?.length ? profile.topics.join(", ") : "None yet."}
              </div>

              <div className="mt-4 text-sm font-semibold">Notes</div>
              <div className="mt-1 text-sm text-black/70 whitespace-pre-wrap">
                {profile.notes?.trim() ? profile.notes : "(none)"}
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
                      <div className="text-sm font-semibold">Assignment: {s.assignmentId}</div>
                      <div className="text-xs text-black/60">
                        {new Date(s.submittedAtISO).toLocaleString()} • Trace events: {s.traceCount}
                      </div>
                      <div className="mt-2 text-sm text-black/70 whitespace-pre-wrap">
                        {s.summarySnippet || "(no summary snippet)"}
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