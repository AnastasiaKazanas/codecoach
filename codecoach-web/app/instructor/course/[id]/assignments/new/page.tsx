"use client";

import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createAssignment, getCourse, seedIfNeeded } from "@/lib/mockDb";

// ✅ Load editor client-side only to avoid SSR/hydration errors
const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-black/10 bg-white p-4 text-sm text-black/60">
      Loading editor…
    </div>
  ),
});

function splitCsv(s: string) {
  return (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("Failed to read file"));
    r.readAsDataURL(file);
  });
}

function htmlLooksEmpty(html: string) {
  // Treat "<p></p>", "<p><br></p>", whitespace, etc as empty
  const stripped = (html || "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "")
    .replace(/<\/?p[^>]*>/gi, "")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, "")
    .trim();
  return stripped.length === 0;
}

function isValidHttpUrl(url: string) {
  if (!url.trim()) return true; // optional
  try {
    const u = new URL(url.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function InstructorCreateAssignmentPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  const [course, setCourse] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [instructionsHtml, setInstructionsHtml] = useState("<p></p>");
  const [fundamentals, setFundamentals] = useState("");
  const [objectives, setObjectives] = useState("");

  const [tutorialUrl, setTutorialUrl] = useState("");
  const [starterFile, setStarterFile] = useState<File | null>(null);

  useEffect(() => {
    try {
      seedIfNeeded();
      setCourse(getCourse(courseId));
      setErr(null);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load course.");
    }
  }, [courseId]);

const canCreate = useMemo(() => {
  if (!title.trim()) return false;
  // require at least 3 non-whitespace characters in the editor
  const plain = (instructionsHtml || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim();

  if (plain.length < 3) return false;
  if (!isValidHttpUrl(tutorialUrl)) return false;
  return true;
}, [title, instructionsHtml, tutorialUrl]);

  return (
    <RequireAuth>
      <AppShell title="Create Assignment">
        {err ? <div className="text-sm text-red-700">{err}</div> : null}

        {course ? (
          <div className="space-y-4">
            <div className="card p-6">
              <div className="text-xl font-bold">Create assignment</div>
              <div className="mt-1 text-sm text-black/60">Course: {course.title}</div>
            </div>

            <div className="card p-6 space-y-5">
              <div className="grid gap-2">
                <div className="text-sm font-semibold">Title</div>
                <input
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="HW1 — Installation & Intro Exercises"
                />
              </div>

              <div className="grid gap-2">
                <div className="text-sm font-semibold">Assignment description</div>
                <div className="text-xs text-black/60">
                  Format text, add links, and insert images (demo stores images in localStorage).
                </div>

                {/* ✅ Rich text editor (HTML) */}
                <RichTextEditor
                  valueHtml={instructionsHtml}
                  onChangeHtml={setInstructionsHtml}
                  placeholder="Write assignment instructions…"
                />

                {/* Optional image upload that embeds into HTML */}
                <div className="flex flex-wrap items-center gap-3">
                  <label className="px-3 py-2 rounded-xl border border-black/10 cursor-pointer bg-white hover:bg-black/5 transition">
                    Upload image
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const input = e.target; // ✅ avoid currentTarget null issues
                        const f = input.files?.[0];
                        if (!f) {
                          input.value = "";
                          return;
                        }

                        const dataUrl = await fileToDataUrl(f);
                        const safeAlt = (f.name || "image").replace(/"/g, "&quot;");

                        // Append an image at the end
                        setInstructionsHtml((prev) => `${prev}<p><img src="${dataUrl}" alt="${safeAlt}" /></p>`);

                        // ✅ reset so same file can be re-selected
                        input.value = "";
                      }}
                    />
                  </label>

                  <div className="text-xs text-black/50">
                    Tip: keep images small (localStorage has limits).
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <div className="text-sm font-semibold">Tutorial link (optional)</div>
                <input
                  className="input"
                  value={tutorialUrl}
                  onChange={(e) => setTutorialUrl(e.target.value)}
                  placeholder="https://…"
                />
                {!isValidHttpUrl(tutorialUrl) ? (
                  <div className="text-xs text-red-700">Please enter a valid http/https URL.</div>
                ) : null}
              </div>

              <div className="grid gap-2">
                <div className="text-sm font-semibold">Starter code (optional)</div>
                <input
                  className="input"
                  type="file"
                  accept=".zip,.py,.txt,.md"
                  onChange={(e) => {
                    const input = e.target;
                    const f = input.files?.[0] ?? null;
                    setStarterFile(f);
                    // don’t clear here; clear after create or if you want “re-select same file”
                  }}
                />
                {starterFile ? (
                  <div className="text-xs text-black/60">Selected: {starterFile.name}</div>
                ) : (
                  <div className="text-xs text-black/50">Upload a zip (recommended) or a single file.</div>
                )}
              </div>

              <div className="grid gap-2">
                <div className="text-sm font-semibold">Fundamentals (comma-separated)</div>
                <input
                  className="input"
                  value={fundamentals}
                  onChange={(e) => setFundamentals(e.target.value)}
                  placeholder="variables, input/output, conditionals"
                />
              </div>

              <div className="grid gap-2">
                <div className="text-sm font-semibold">Objectives (comma-separated)</div>
                <input
                  className="input"
                  value={objectives}
                  onChange={(e) => setObjectives(e.target.value)}
                  placeholder="use input(), print formatted output, write if statements"
                />
              </div>
              
              <div className="text-xs text-black/60">
                Debug: title={title.trim() ? "✅" : "❌"} • description= 
                {htmlLooksEmpty(instructionsHtml) ? "❌ (empty)" : "✅"} • tutorial=
                {!isValidHttpUrl(tutorialUrl) ? "❌ (bad url)" : "✅"}
              </div>

              <div className="flex gap-2">
                <button
                  className="btn-primary"
                  disabled={!canCreate}
                  onClick={async () => {
                    try {
                      if (!title.trim()) throw new Error("Title required.");
                      if (htmlLooksEmpty(instructionsHtml)) throw new Error("Description required.");
                      if (!isValidHttpUrl(tutorialUrl)) throw new Error("Tutorial link must be a valid URL.");

                      let starterCode: any = null;

                      if (starterFile) {
                        const dataUrl = await fileToDataUrl(starterFile);
                        starterCode = {
                          filename: starterFile.name,
                          mime: starterFile.type || "application/octet-stream",
                          dataUrl,
                        };
                      }

                      // NOTE: this assumes your createAssignment supports these fields
                      createAssignment(courseId, {
                        title,
                        instructionsHtml,
                        fundamentals: splitCsv(fundamentals),
                        objectives: splitCsv(objectives),
                        tutorialUrl: tutorialUrl.trim() ? tutorialUrl.trim() : undefined,
                        starterCode,
                      } as any);

                      router.push(`/instructor/course/${courseId}/assignments`);
                    } catch (e: any) {
                      alert(e?.message ?? "Failed to create assignment.");
                    }
                  }}
                >
                  Create
                </button>

                <button
                  className="px-3 py-2 rounded-xl border border-black/10"
                  onClick={() => router.push(`/instructor/course/${courseId}/assignments`)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-black/60">Loading…</div>
        )}
      </AppShell>
    </RequireAuth>
  );
}