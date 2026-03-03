"use client";

import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAssignment, getStarterZipSignedUrl } from "@/lib/db";

function safeArray(value: any): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export default function InstructorAssignmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.assignmentId as string;

  const [assignment, setAssignment] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const a = await getAssignment(assignmentId);
        setAssignment(a);
      } catch (e: any) {
        setErr(e.message);
      }
    }

    load();
  }, [assignmentId]);

  if (!assignment) {
    return (
      <RequireAuth>
        <AppShell title="Assignment">
          <div className="text-sm text-black/60">Loading…</div>
        </AppShell>
      </RequireAuth>
    );
  }

  // Safe parsing
  const fundamentals = safeArray(assignment.fundamentals);
  const objectives = safeArray(assignment.objectives);

  let starterBundle: any = null;

  if (assignment.starter_bundle) {
    if (typeof assignment.starter_bundle === "string") {
      try {
        starterBundle = JSON.parse(assignment.starter_bundle);
      } catch {
        starterBundle = null;
      }
    } else {
      starterBundle = assignment.starter_bundle;
    }
  }

  return (
    <RequireAuth>
      <AppShell title="Assignment">
        {err ? <div className="text-sm text-red-700">{err}</div> : null}

        {/* Header with Edit Button */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">{assignment.title}</h1>

          <button
            className="btn-primary"
            onClick={() =>
              router.push(
                `/instructor/course/${assignment.course_id}/assignments/${assignment.id}/edit`
              )
            }
          >
            Edit Assignment
          </button>
        </div>

        {/* Instructions Card */}
        <div className="card p-6 space-y-4">
          <div
            className="prose"
            dangerouslySetInnerHTML={{
              __html: assignment.instructions_html ?? "",
            }}
          />
        </div>

        {/* Learning Goals Card */}
        {(fundamentals.length > 0 ||
          objectives.length > 0 ||
          assignment.tutorial_url ||
          starterBundle?.zipPath) && (
          <div className="card p-6 mt-8 space-y-6">

            {/* Fundamentals */}
            {fundamentals.length > 0 && (
              <div>
                <div className="text-lg font-semibold mb-3">Fundamentals</div>
                <ul className="list-disc ml-6 space-y-1 text-black/80">
                  {fundamentals.map((f: string, i: number) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Objectives */}
            {objectives.length > 0 && (
              <div>
                <div className="text-lg font-semibold mb-3">Objectives</div>
                <ul className="list-disc ml-6 space-y-1 text-black/80">
                  {objectives.map((o: string, i: number) => (
                    <li key={i}>{o}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tutorial */}
            {assignment.tutorial_url && (
              <div>
                <div className="text-lg font-semibold mb-3">Tutorial</div>
                <a
                  href={assignment.tutorial_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-700 underline"
                >
                  Open Tutorial
                </a>
              </div>
            )}

            {/* Starter Zip */}
            {starterBundle?.zipPath &&
              typeof starterBundle.zipPath === "string" &&
              starterBundle.zipPath.trim().length > 0 && (
              <div>
                <div className="text-lg font-semibold mb-3">
                  Starter Files
                </div>
                <button
                  className="btn-primary"
                  onClick={async () => {
                    try {
                      const url = await getStarterZipSignedUrl(
                        starterBundle.zipPath
                      );
                      window.open(url, "_blank");
                    } catch (e: any) {
                      alert(e.message);
                    }
                  }}
                >
                  Download Starter Zip
                </button>
              </div>
            )}
          </div>
        )}
      </AppShell>
    </RequireAuth>
  );
}