"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { getAssignmentLearning, getCurrentUser } from "@/lib/db";

export default function AssignmentProfilePage() {
  const params = useParams();

  const assignmentId = params.assignmentId as string;

  const [data, setData] = useState<any>(null);

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser();
      if (!user?.email) return;
      const d = await getAssignmentLearning(assignmentId, user.email);
      setData(d);
    }

    load();
  }, [assignmentId]);

  if (!data) return null;

  return (
    <RequireAuth>
      <AppShell title="Assignment Progress">

        <div className="space-y-6">

          <div className="card p-6">
            <h2 className="font-semibold text-lg mb-2">
              AI Learning Summary
            </h2>

            <p className="text-sm whitespace-pre-line">
              {data.summary}
            </p>
          </div>

          <div className="card p-6">
            <h2 className="font-semibold mb-2">
              Mastered
            </h2>

            <ul className="list-disc ml-5 text-sm">
              {data.mastered?.map((m: string) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>

          <div className="card p-6">
            <h2 className="font-semibold mb-2">
              Developing
            </h2>

            <ul className="list-disc ml-5 text-sm">
              {data.developing?.map((d: string) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>

        </div>

      </AppShell>
    </RequireAuth>
  );
}