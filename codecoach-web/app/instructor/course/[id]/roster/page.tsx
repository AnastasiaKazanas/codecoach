"use client";

import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCourse, getRoster, seedIfNeeded } from "@/lib/mockDb";

export default function InstructorRosterPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  const [course, setCourse] = useState<any>(null);
  const [roster, setRoster] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    try {
      seedIfNeeded();
      setCourse(getCourse(courseId));
      setRoster(getRoster(courseId));
      setErr(null);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load roster.");
    }
  }, [courseId]);

  return (
    <RequireAuth>
      <AppShell title="Roster">
        {err ? <div className="text-sm text-red-700">{err}</div> : null}

        {course ? (
          <div className="space-y-4">
            <div className="card p-6">
              <div className="text-xl font-bold">{course.title}</div>
              <div className="mt-1 text-sm text-black/60">
                Click a student to view their class profile.
              </div>
            </div>

            {roster.length === 0 ? (
              <div className="text-sm text-black/60">No students enrolled yet.</div>
            ) : (
              <div className="grid gap-2">
                {roster.map((email) => (
                  <button
                    key={email}
                    className="w-full text-left rounded-2xl border border-black/10 bg-white p-4 hover:bg-black/5 transition"
                    onClick={() =>
                      router.push(`/instructor/course/${courseId}/student/${encodeURIComponent(email)}`)
                    }
                  >
                    <div className="text-sm font-semibold">{email}</div>
                    <div className="text-xs text-black/60">View profile</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-black/60">Loading…</div>
        )}
      </AppShell>
    </RequireAuth>
  );
}