"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { getAssignment, getCourse, seedIfNeeded } from "@/lib/mockDb";
import { useParams } from "next/navigation";

export default function StudentAssignmentPage() {
  const params = useParams<{ assignmentId: string }>();
  const assignmentId = params?.assignmentId;

  const [a, setA] = useState<any>(null);
  const [course, setCourse] = useState<any>(null);

  useEffect(() => {
    if (!assignmentId) return;

    seedIfNeeded();
    const asmt = getAssignment(assignmentId);
    setA(asmt);
    setCourse(getCourse(asmt.courseId));
  }, [assignmentId]);

  if (!assignmentId) return null;
  if (!a || !course) return null;

  return (
    <RequireAuth>
      <AppShell title={a.title}>
        <div className="space-y-6">
          <div className="text-sm text-black/60">{course.title}</div>

          <div className="rounded-2xl border border-black/10 bg-white p-4">
            <div className="text-sm font-semibold">Assignment ID (for VS Code)</div>
            <div className="mt-2 flex gap-3 items-center">
              <code className="rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-sm">
                {a.id}
              </code>
              <button
                className="btn-secondary"
                onClick={() => navigator.clipboard.writeText(a.id)}
              >
                Copy
              </button>
            </div>
            <div className="mt-3 text-sm text-black/60">
              In VS Code: Command Palette → <b>CodeCoach: Open Assignment</b> → paste this ID.
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold">Objectives</div>
            <ul className="list-disc pl-6 text-sm text-black/70">
              {(a.objectives || []).map((x: string) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold">Fundamentals</div>
            <div className="text-sm text-black/70">{(a.fundamentals || []).join(", ")}</div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold">Instructions</div>
            <pre className="whitespace-pre-wrap text-sm text-black/70 rounded-2xl border border-black/10 bg-white p-4">
              {a.instructions}
            </pre>
          </div>
        </div>
      </AppShell>
    </RequireAuth>
  );
}