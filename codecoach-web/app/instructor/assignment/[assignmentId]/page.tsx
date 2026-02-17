"use client";

import AppShell from "@/components/AppShell";
import RequireAuth from "@/components/RequireAuth";
import { AssignmentsAPI, SessionsAPI } from "@/lib/api";
import { useEffect, useState } from "react";

export default function InstructorAssignmentPage({ params }: { params: { assignmentId: string } }) {
  const assignmentId = params.assignmentId;
  const [assignment, setAssignment] = useState<any | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      const a = await AssignmentsAPI.get(assignmentId);
      setAssignment(a);
      const s = await SessionsAPI.instructorSessionsForAssignment(assignmentId);
      setSessions(s.sessions || []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load assignment");
    }
  }

  useEffect(() => {
    load();
  }, [assignmentId]);

  return (
    <RequireAuth>
      <AppShell>
        <div className="card p-6">
          <div className="text-xl font-bold">Assignment</div>
          <div className="mt-1 text-sm text-black/60">Assignment ID: {assignmentId}</div>

          {err ? <div className="mt-4 text-sm text-red-700">{err}</div> : null}

          {assignment ? (
            <div className="mt-6 card p-5">
              <div className="font-semibold">{assignment.title}</div>
              <div className="mt-2 text-sm text-black/70 whitespace-pre-wrap">{assignment.instructions}</div>

              <div className="mt-3 flex flex-wrap gap-2">
                {(assignment.fundamentals || []).map((f: string) => <span key={f} className="badge">{f}</span>)}
              </div>
            </div>
          ) : null}

          <div className="mt-6">
            <div className="text-sm font-semibold">Submissions (sessions)</div>
            <div className="mt-3 grid gap-3">
              {sessions.map((s) => (
                <a key={s.id} href={`/instructor/session/${s.id}`} className="card p-5 hover:bg-black/5 transition">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">Session {s.id}</div>
                    <span className="badge">{s.status}</span>
                  </div>
                  <div className="mt-1 text-sm text-black/60">Student: {s.studentId}</div>
                  <div className="mt-1 text-xs text-black/50">Created: {s.createdAtISO}</div>
                  {s.submittedAtISO ? <div className="mt-1 text-xs text-black/50">Submitted: {s.submittedAtISO}</div> : null}
                </a>
              ))}
              {sessions.length === 0 ? <div className="text-sm text-black/60">No submissions yet.</div> : null}
            </div>
          </div>
        </div>
      </AppShell>
    </RequireAuth>
  );
}