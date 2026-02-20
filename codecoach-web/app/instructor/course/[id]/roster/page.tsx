"use client";

import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCourse, getRoster } from "@/lib/mockDb";

export default function InstructorRosterPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  const [course, setCourse] = useState<any>(null);
  const [roster, setRoster] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setErr(null);

        const c = await getCourse(courseId);
        const r = await getRoster(courseId);

        setCourse(c);
        setRoster(r);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load roster.");
      }
    }

    load();
  }, [courseId]);

  return (
    <RequireAuth>
      <AppShell title="Roster">
        {err ? <div className="text-sm text-red-700">{err}</div> : null}

        {course ? (
          <div className="space-y-6">
            <div className="card p-6">
              <div className="text-xl font-bold">{course.title}</div>
              <div className="mt-1 text-sm text-black/60">Roster</div>

              <div className="mt-4">
                <button
                  className="px-3 py-2 rounded-xl border border-black/10 hover:bg-black/5 transition"
                  onClick={() => router.push(`/instructor/course/${courseId}`)}
                >
                  Back to course
                </button>
              </div>
            </div>

            <div className="card p-6">
              <div className="text-sm font-semibold">Students</div>

              {roster.length === 0 ? (
                <div className="mt-2 text-sm text-black/60">No students enrolled yet.</div>
              ) : (
                <div className="mt-3 grid gap-2">
                  {roster.map((row, idx) => (
                    <div key={row.id ?? idx} className="rounded-xl border border-black/10 p-3">
                      <div className="font-semibold">{row.student_email ?? row.email ?? "(unknown)"}</div>
                      <div className="text-xs text-black/60">
                        {row.created_at ? new Date(row.created_at).toLocaleString() : ""}
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