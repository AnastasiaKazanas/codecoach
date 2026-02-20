"use client";

import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  getCourse,
  getCourseProfile,
  getCourseAssignments,
  getSubmissionsForStudentInCourse,
} from "@/lib/mockDb";

export default function InstructorStudentInCoursePage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;
  const studentEmail = decodeURIComponent(params.email as string);

  const [course, setCourse] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

async function refresh() {
  try {
    setErr(null);

    const c = await getCourse(courseId);
    const p = await getCourseProfile(courseId, studentEmail);
    const a = await getCourseAssignments(courseId);
    const s = await getSubmissionsForStudentInCourse(courseId, studentEmail);

    setCourse(c);
    setProfile(p);
    setAssignments(a);
    setSubs(s);
  } catch (e: any) {
    setErr(e?.message ?? "Failed to load student details.");
  }
}

useEffect(() => {
  refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [courseId, studentEmail]);

  const subsByAssignment = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const s of subs) {
      const list = map.get(s.assignmentId) ?? [];
      list.push(s);
      map.set(s.assignmentId, list);
    }
    return map;
  }, [subs]);

  return (
    <RequireAuth>
      <AppShell title="Student Progress">
        {err ? <div className="text-sm text-red-700">{err}</div> : null}

        {course && profile ? (
          <div className="space-y-6">
            <div className="card p-6">
              <div className="text-xl font-bold">{studentEmail}</div>
              <div className="mt-1 text-sm text-black/60">
                {course.title} • Last updated: {new Date(profile.updatedAtISO).toLocaleString()}
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  className="btn-secondary"
                  onClick={() => router.push(`/instructor/course/${courseId}/roster`)}
                >
                  Back to roster
                </button>
                <button className="btn-secondary" onClick={refresh}>
                  Refresh
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="card p-4">
                <div className="text-sm font-semibold">Mastered</div>
                {profile.mastered?.length ? (
                  <ul className="mt-2 text-sm list-disc ml-5">
                    {profile.mastered.map((x: string) => <li key={x}>{x}</li>)}
                  </ul>
                ) : (
                  <div className="mt-2 text-sm text-black/60">None yet.</div>
                )}
              </div>

              <div className="card p-4">
                <div className="text-sm font-semibold">Developing</div>
                {profile.developing?.length ? (
                  <ul className="mt-2 text-sm list-disc ml-5">
                    {profile.developing.map((x: string) => <li key={x}>{x}</li>)}
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

              <div className="mt-4 text-sm font-semibold">Instructor notes</div>
              <div className="mt-1 text-sm text-black/70 whitespace-pre-wrap">
                {profile.notes?.trim() ? profile.notes : "(none)"}
              </div>
            </div>

            <div className="card p-6">
              <div className="text-sm font-semibold mb-3">Work by assignment</div>

              {assignments.length === 0 ? (
                <div className="text-sm text-black/60">No assignments in this course yet.</div>
              ) : (
                <div className="grid gap-3">
                  {assignments.map((a) => {
                    const list = subsByAssignment.get(a.id) ?? [];
                    const latest = list[0];
                    return (
                      <div key={a.id} className="rounded-2xl border border-black/10 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-base font-bold">{a.title}</div>
                            <div className="text-xs text-black/60 mt-1">
                              ID: <span className="font-mono">{a.id}</span>
                            </div>
                          </div>
                          <button
                            className="btn-secondary text-sm"
                            onClick={() =>
                              router.push(`/instructor/course/${courseId}/assignments/${encodeURIComponent(a.id)}`)
                            }
                          >
                            View assignment
                          </button>
                        </div>

                        {list.length === 0 ? (
                          <div className="mt-3 text-sm text-black/60">No submission yet.</div>
                        ) : (
                          <div className="mt-3">
                            <div className="text-sm font-semibold">Latest submission</div>
                            <div className="text-xs text-black/60">
                              {new Date(latest.submittedAtISO).toLocaleString()} • Trace: {latest.traceCount}
                            </div>
                            <div className="mt-2 text-sm text-black/70 whitespace-pre-wrap">
                              {latest.summarySnippet || "(no summary snippet)"}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
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