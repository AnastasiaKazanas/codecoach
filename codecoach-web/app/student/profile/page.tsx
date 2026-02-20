"use client";

import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { getAuth } from "@/lib/storage";
import {
  getOverallProfile,
  getAllCourseProfilesForStudent,
  getCourse,
  recomputeOverallProfile,
  seedIfNeeded,
} from "@/lib/mockDb";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function StudentOverallProfilePage() {
  const router = useRouter();
  const auth = getAuth();
  const email = auth?.email ?? "";

  const [overall, setOverall] = useState<any>(null);
  const [courseProfiles, setCourseProfiles] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  function refresh() {
    try {
      seedIfNeeded();
      // keep it up to date
      recomputeOverallProfile(email);

      setOverall(getOverallProfile(email));
      setCourseProfiles(getAllCourseProfilesForStudent(email));
      setErr(null);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load overall profile.");
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <RequireAuth>
      <AppShell title="My Learning Summary">
        {err ? <div className="text-sm text-red-700">{err}</div> : null}

        {overall ? (
          <div className="space-y-6">
            <div className="card p-6">
              <div className="text-xl font-bold">Overall learning summary</div>
              <div className="mt-1 text-sm text-black/60">
                Last updated: {new Date(overall.updatedAtISO).toLocaleString()}
              </div>

              <div className="mt-4 flex gap-2">
                <button className="btn-secondary" onClick={() => router.push("/student")}>
                  Back to My Courses
                </button>
                <button className="btn-secondary" onClick={refresh}>
                  Refresh
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="card p-4">
                <div className="text-sm font-semibold">Fundamentals mastered</div>
                {overall.mastered?.length ? (
                  <ul className="mt-2 text-sm list-disc ml-5">
                    {overall.mastered.map((x: string) => <li key={x}>{x}</li>)}
                  </ul>
                ) : (
                  <div className="mt-2 text-sm text-black/60">None yet.</div>
                )}
              </div>

              <div className="card p-4">
                <div className="text-sm font-semibold">Fundamentals developing</div>
                {overall.developing?.length ? (
                  <ul className="mt-2 text-sm list-disc ml-5">
                    {overall.developing.map((x: string) => <li key={x}>{x}</li>)}
                  </ul>
                ) : (
                  <div className="mt-2 text-sm text-black/60">None yet.</div>
                )}
              </div>
            </div>

            <div className="card p-4">
              <div className="text-sm font-semibold">Topics covered</div>
              <div className="mt-2 text-sm text-black/70">
                {overall.topics?.length ? overall.topics.join(", ") : "None yet."}
              </div>
            </div>

            <div className="card p-4">
              <div className="text-sm font-semibold">Per-course breakdown</div>
              {courseProfiles.length === 0 ? (
                <div className="mt-2 text-sm text-black/60">No course profiles yet.</div>
              ) : (
                <div className="mt-3 grid gap-3">
                  {courseProfiles.map((p) => {
                    let title = p.courseId;
                    try {
                      title = getCourse(p.courseId).title;
                    } catch {}
                    return (
                      <div key={`${p.courseId}-${p.studentEmail}`} className="rounded-xl border border-black/10 p-4">
                        <div className="text-sm font-semibold">{title}</div>
                        <div className="text-xs text-black/60">
                          Updated: {new Date(p.updatedAtISO).toLocaleString()}
                        </div>
                        <div className="mt-2 text-sm text-black/70">
                          <span className="font-semibold">Mastered:</span>{" "}
                          {p.mastered?.length ? p.mastered.join(", ") : "—"}
                        </div>
                        <div className="text-sm text-black/70">
                          <span className="font-semibold">Developing:</span>{" "}
                          {p.developing?.length ? p.developing.join(", ") : "—"}
                        </div>
                        <div className="text-sm text-black/70">
                          <span className="font-semibold">Topics:</span>{" "}
                          {p.topics?.length ? p.topics.join(", ") : "—"}
                        </div>
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