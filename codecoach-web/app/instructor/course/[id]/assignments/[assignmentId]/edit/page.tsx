"use client";

import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAssignment, updateAssignment } from "@/lib/db";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
});

export default function InstructorEditAssignmentPage() {
  const params = useParams();
  const router = useRouter();

  const courseId = params.id as string;
  const assignmentId = params.assignmentId as string;

  const [assignment, setAssignment] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [instructionsHtml, setInstructionsHtml] = useState("");
  const [fundamentals, setFundamentals] = useState("");
  const [objectives, setObjectives] = useState("");
  const [tutorialUrl, setTutorialUrl] = useState("");
  const [starterZipFile, setStarterZipFile] = useState<File | null>(null);

  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const a = await getAssignment(assignmentId);
        setAssignment(a);
        setTitle(a.title ?? "");
        setInstructionsHtml(a.instructions_html ?? "");
        setFundamentals(
          Array.isArray(a.fundamentals)
            ? a.fundamentals.join(", ")
            : (a.fundamentals ?? "")
        );
        setObjectives(
          Array.isArray(a.objectives)
            ? a.objectives.join(", ")
            : (a.objectives ?? "")
        );
        setTutorialUrl(a.tutorial_url ?? "");
      } catch (e: any) {
        setErr(e.message);
      }
    }

    load();
  }, [assignmentId]);

  if (!assignment) {
    return (
      <RequireAuth>
        <AppShell title="Edit Assignment">
          <div className="text-sm text-black/60">Loading…</div>
        </AppShell>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <AppShell title="Edit Assignment">
        {err ? <div className="text-sm text-red-700">{err}</div> : null}

        <div className="space-y-5 card p-6">

          <div className="grid gap-2">
            <div className="text-sm font-semibold">Title</div>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <div className="text-sm font-semibold">Description</div>
            <RichTextEditor
              valueHtml={instructionsHtml}
              onChangeHtml={setInstructionsHtml}
            />
          </div>

          <div className="grid gap-2">
            <div className="text-sm font-semibold">Tutorial link</div>
            <input
              className="input"
              value={tutorialUrl}
              onChange={(e) => setTutorialUrl(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <div className="text-sm font-semibold">Fundamentals</div>
            <input
              className="input"
              value={fundamentals}
              onChange={(e) => setFundamentals(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <div className="text-sm font-semibold">Objectives</div>
            <input
              className="input"
              value={objectives}
              onChange={(e) => setObjectives(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <div className="text-sm font-semibold">Replace starter zip (optional)</div>
            <input
              type="file"
              accept=".zip"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setStarterZipFile(f);
              }}
            />
          </div>

          <div className="flex gap-3">
            <button
              className="btn-primary"
              onClick={async () => {
                try {
                  await updateAssignment({
                    id: assignmentId,
                    title,
                    instructionsHtml,
                    tutorialUrl,
                    fundamentals: fundamentals.split(",").map((s) => s.trim()).filter(Boolean),
                    objectives: objectives.split(",").map((s) => s.trim()).filter(Boolean),
                    starterZipFile: starterZipFile ?? undefined,
                  });

                  router.push(
                    `/instructor/course/${courseId}/assignments/${assignmentId}`
                  );
                } catch (e: any) {
                  alert(e.message);
                }
              }}
            >
              Save Changes
            </button>

            <button
              className="px-3 py-2 rounded-xl border border-black/10"
              onClick={() =>
                router.push(
                  `/instructor/course/${courseId}/assignments/${assignmentId}`
                )
              }
            >
              Cancel
            </button>
          </div>
        </div>
      </AppShell>
    </RequireAuth>
  );
}