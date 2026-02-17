"use client";

import AppShell from "@/components/AppShell";
import RequireAuth from "@/components/RequireAuth";
import { SessionsAPI } from "@/lib/api";
import { useEffect, useState } from "react";

export default function InstructorSessionTracePage({ params }: { params: { sessionId: string } }) {
  const sessionId = params.sessionId;
  const [data, setData] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      const res = await SessionsAPI.instructorTrace(sessionId);
      setData(res);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load trace");
    }
  }

  useEffect(() => {
    load();
  }, [sessionId]);

  return (
    <RequireAuth>
      <AppShell>
        <div className="card p-6">
          <div className="text-xl font-bold">Learning Trace</div>
          <div className="mt-1 text-sm text-black/60">Session ID: {sessionId}</div>

          {err ? <div className="mt-4 text-sm text-red-700">{err}</div> : null}

          {data ? (
            <>
              <div className="mt-6 card p-5">
                <div className="text-sm font-semibold">Session</div>
                <div className="mt-2 text-sm text-black/70">
                  <div><span className="text-black/50">Student:</span> {data.session.studentId}</div>
                  <div><span className="text-black/50">Assignment:</span> {data.session.assignmentId}</div>
                  <div><span className="text-black/50">Status:</span> {data.session.status}</div>
                </div>
              </div>

              <div className="mt-6">
                <div className="text-sm font-semibold">Events</div>
                <div className="mt-3 grid gap-2">
                  {data.events.map((e: any, idx: number) => (
                    <div key={idx} className="card p-4">
                      <div className="flex items-center justify-between">
                        <span className="badge">{e.type}</span>
                        <span className="text-xs text-black/50">{e.ts}</span>
                      </div>
                      <pre className="mt-2 whitespace-pre-wrap text-sm text-black/80">
{JSON.stringify(e.payload, null, 2)}
                      </pre>
                    </div>
                  ))}
                  {data.events.length === 0 ? (
                    <div className="text-sm text-black/60">No events yet.</div>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </AppShell>
    </RequireAuth>
  );
}