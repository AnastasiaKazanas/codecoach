"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { getCourse, getCourseAssignments, seedIfNeeded } from "@/lib/mockDb";
import { useRouter, useParams } from "next/navigation";

export default function StudentCoursePage() {
  const router = useRouter();
  const params = useParams<{ courseId: string }>();
  const courseId = params?.courseId;

  const [course, setCourse] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);

  useEffect(() => {
    if (!courseId) return;
    seedIfNeeded();
    setCourse(getCourse(courseId));
    setAssignments(getCourseAssignments(courseId));
  }, [courseId]);

  if (!courseId) return null;
  if (!course) return null;

  return (
    <RequireAuth>
      <AppShell title={course.title}>
        <div className="space-y-6">
          <div className="text-sm text-black/60">{course.term}</div>

          <div className="text-sm font-semibold">Assignments</div>
          {assignments.length === 0 ? (
            <div className="text-sm text-black/60">No assignments yet.</div>
          ) : (
            <div className="grid gap-3">
              {assignments.map((a) => (
                <button
                  key={a.id}
                  className="w-full text-left rounded-2xl border border-black/10 bg-white p-4 hover:bg-black/5 transition"
                  onClick={() => router.push(`/student/assignment/${a.id}`)}
                >
                  <div className="text-base font-bold">{a.title}</div>
                  <div className="text-sm text-black/60">
                    Fundamentals: {a.fundamentals.join(", ")}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}