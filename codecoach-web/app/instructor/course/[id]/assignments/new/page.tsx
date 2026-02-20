"use client";

import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createAssignment,
  getCourse,
  seedIfNeeded,
  StarterBundle,
  StarterFileAsset,
} from "@/lib/mockDb";

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

function htmlLooksEmpty(html: string) {
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
  if (!url.trim()) return true;
  try {
    const u = new URL(url.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("Failed to read file"));
    r.readAsDataURL(file);
  });
}

async function buildStarterBundleFromFiles(files: FileList): Promise<StarterBundle> {
  const arr = Array.from(files);

  const assets: StarterFileAsset[] = await Promise.all(
    arr.map(async (f) => {
      const dataUrl = await fileToDataUrl(f);
      const path = (f as any).webkitRelativePath || f.name; // folder picker preserves this
      return {
        path,
        filename: f.name,
        mime: f.type || "application/octet-stream",
        dataUrl,
      };
    })
  );

  assets.sort((a, b) => a.path.localeCompare(b.path));
  return { files: assets };
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

  const [starterBundle, setStarterBundle] = useState<StarterBundle | null>(null);
  const [starterLabel, setStarterLabel] = useState<string>("");

  // ✅ Folder input ref so we can set the non-standard attribute safely
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      seedIfNeeded();
      setCourse(getCourse(courseId));
      setErr(null);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load course.");
    }
  }, [courseId]);

  useEffect(() => {
    // ✅ This removes the TS error and still enables folder picking in Chrome/Edge
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "");
      folderInputRef.current.setAttribute("directory", "");
    }
  }, []);

  const canCreate = useMemo(() => {
    if (!title.trim()) return false;
    if (htmlLooksEmpty(instructionsHtml)) return false;
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
                  placeholder="HW2 — Intro to Tkinter"
                />
              </div>

              <div className="grid gap-2">
                <div className="text-sm font-semibold">Assignment description</div>
                <div className="text-xs text-black/60">
                  Format text, add links, and insert images (demo stores content in localStorage).
                </div>

                <RichTextEditor
                  valueHtml={instructionsHtml}
                  onChangeHtml={setInstructionsHtml}
                  placeholder="Write assignment instructions…"
                />

                <div className="flex flex-wrap items-center gap-3">
                  <label className="px-3 py-2 rounded-xl border border-black/10 cursor-pointer bg-white hover:bg-black/5 transition">
                    Upload image
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const input = e.target as HTMLInputElement;
                        const f = input.files?.[0];
                        if (!f) return;

                        const dataUrl = await fileToDataUrl(f);
                        const safeAlt = (f.name || "image").replace(/"/g, "&quot;");
                        setInstructionsHtml((prev) => `${prev}<p><img src="${dataUrl}" alt="${safeAlt}" /></p>`);
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
                <div className="text-sm font-semibold">Starter files (optional)</div>

                <div className="flex flex-wrap gap-3 items-center">
                  {/* Zip picker */}
                  <label className="px-3 py-2 rounded-xl border border-black/10 cursor-pointer bg-white hover:bg-black/5 transition">
                    Upload zip
                    <input
                      type="file"
                      accept=".zip,application/zip"
                      className="hidden"
                      onChange={async (e) => {
                        const input = e.target as HTMLInputElement;
                        const f = input.files?.[0];
                        if (!f) return;

                        const dataUrl = await fileToDataUrl(f);
                        setStarterBundle({
                          files: [
                            {
                              path: f.name,
                              filename: f.name,
                              mime: f.type || "application/zip",
                              dataUrl,
                            },
                          ],
                        });
                        setStarterLabel(`Zip: ${f.name}`);
                        input.value = "";
                      }}
                    />
                  </label>

                  {/* Multi-file picker */}
                  <label className="px-3 py-2 rounded-xl border border-black/10 cursor-pointer bg-white hover:bg-black/5 transition">
                    Upload files
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={async (e) => {
                        const input = e.target as HTMLInputElement;
                        if (!input.files?.length) return;

                        const bundle = await buildStarterBundleFromFiles(input.files);
                        setStarterBundle(bundle);
                        setStarterLabel(`${bundle.files.length} file(s)`);
                        input.value = "";
                      }}
                    />
                  </label>

                  {/* Folder picker (Chromium) */}
                  <label className="px-3 py-2 rounded-xl border border-black/10 cursor-pointer bg-white hover:bg-black/5 transition">
                    Upload folder
                    <input
                      ref={folderInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={async (e) => {
                        const input = e.target as HTMLInputElement;
                        if (!input.files?.length) return;

                        const bundle = await buildStarterBundleFromFiles(input.files);
                        setStarterBundle(bundle);
                        setStarterLabel(`Folder: ${bundle.files.length} file(s)`);
                        input.value = "";
                      }}
                    />
                  </label>

                  {starterBundle ? (
                    <button
                      className="px-3 py-2 rounded-xl border border-black/10 bg-white hover:bg-black/5 transition text-sm"
                      onClick={() => {
                        setStarterBundle(null);
                        setStarterLabel("");
                      }}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>

                {starterLabel ? <div className="text-xs text-black/60">Selected: {starterLabel}</div> : null}
              </div>

              <div className="grid gap-2">
                <div className="text-sm font-semibold">Fundamentals (comma-separated)</div>
                <input
                  className="input"
                  value={fundamentals}
                  onChange={(e) => setFundamentals(e.target.value)}
                  placeholder="modules, documentation, functions"
                />
              </div>

              <div className="grid gap-2">
                <div className="text-sm font-semibold">Objectives (comma-separated)</div>
                <input
                  className="input"
                  value={objectives}
                  onChange={(e) => setObjectives(e.target.value)}
                  placeholder="read module docs, write your own functions"
                />
              </div>

              <div className="flex gap-2">
                <button
                  className="btn-primary"
                  disabled={!canCreate}
                  onClick={() => {
                    try {
                      if (!title.trim()) throw new Error("Title required.");
                      if (htmlLooksEmpty(instructionsHtml)) throw new Error("Description required.");
                      if (!isValidHttpUrl(tutorialUrl)) throw new Error("Tutorial link must be a valid URL.");

                      createAssignment(courseId, {
                        title,
                        instructionsHtml,
                        fundamentals: splitCsv(fundamentals),
                        objectives: splitCsv(objectives),
                        tutorialUrl: tutorialUrl.trim() ? tutorialUrl.trim() : undefined,
                        starterBundle: starterBundle ?? null,
                      });

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