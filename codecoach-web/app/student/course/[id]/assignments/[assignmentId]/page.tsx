"use client";

import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getAssignment, getCourse } from "@/lib/db";
import { supabase } from "@/lib/supabase";

type StarterFile = {
  path: string;
  filename: string;
  mime: string;
  dataUrl: string;
};

type TreeNode =
  | { type: "dir"; name: string; children: Record<string, TreeNode> }
  | { type: "file"; name: string; file: StarterFile };

function buildTree(files: StarterFile[]): TreeNode {
  const root: TreeNode = { type: "dir", name: "", children: {} };

  for (const f of files) {
    const parts = (f.path || f.filename || "file").split("/").filter(Boolean);
    let cur = root as Extract<TreeNode, { type: "dir" }>;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const isLast = i === parts.length - 1;

      if (isLast) {
        cur.children[part] = { type: "file", name: part, file: f };
      } else {
        const existing = cur.children[part];
        if (!existing || existing.type !== "dir") {
          cur.children[part] = { type: "dir", name: part, children: {} };
        }
        cur = cur.children[part] as Extract<TreeNode, { type: "dir" }>;
      }
    }
  }

  return root;
}

function sortTreeChildren(children: Record<string, TreeNode>) {
  const entries = Object.entries(children);
  entries.sort(([aName, aNode], [bName, bNode]) => {
    if (aNode.type !== bNode.type) return aNode.type === "dir" ? -1 : 1;
    return aName.localeCompare(bName);
  });
  return entries;
}

function triggerDownload(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename || "download";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function TreeView({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  if (node.type === "file") {
    return (
      <div className="flex items-center justify-between gap-3 py-1">
        <div className="truncate" style={{ paddingLeft: depth * 12 }}>
          <span className="text-black/70">📄</span>{" "}
          <span className="font-mono text-sm">{node.name}</span>
        </div>
        <button
          className="text-sm underline"
          onClick={() => triggerDownload(node.file.dataUrl, node.file.filename)}
        >
          Download
        </button>
      </div>
    );
  }

  const entries = sortTreeChildren(node.children);

  return (
    <div>
      {node.name ? (
        <details open className="py-1">
          <summary
            className="cursor-pointer select-none"
            style={{ paddingLeft: depth * 12 }}
          >
            <span className="text-black/70">📁</span>{" "}
            <span className="font-medium">{node.name}</span>
          </summary>
          <div className="mt-1">
            {entries.map(([k, child]) => (
              <TreeView key={k} node={child} depth={depth + 1} />
            ))}
          </div>
        </details>
      ) : (
        <div>
          {entries.map(([k, child]) => (
            <TreeView key={k} node={child} depth={depth} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function StudentAssignmentDetailPage() {
  const params = useParams<{ id: string; assignmentId: string }>();
  const router = useRouter();

  const courseId = params?.id;
  const assignmentId = params?.assignmentId ? decodeURIComponent(params.assignmentId) : "";

  const [course, setCourse] = useState<any>(null);
  const [asmt, setAsmt] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  
  // Supabase JWT (access token) used only to let the VS Code extension fetch settings from /api/me/codecoach
  const [supabaseJwt, setSupabaseJwt] = useState<string | null>(null);

  // Values stored server-side in user_settings (returned by /api/me/codecoach)
  const [codecoachToken, setCodecoachToken] = useState("");
  const [geminiKey, setGeminiKey] = useState("");

  const [authToken, setAuthToken] = useState<string | null>(null);

   // Load assignment + course
  useEffect(() => {
    async function load() {
      try {
        setErr(null);
        if (!courseId || !assignmentId) return;

        const c = await getCourse(courseId);
        const a = await getAssignment(assignmentId);

        setCourse(c);
        setAsmt(a);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load assignment.");
      }
    }
    load();
  }, [courseId, assignmentId]);

  // Load Supabase access token (JWT) once
  useEffect(() => {
    async function loadToken() {
      const { data } = await supabase.auth.getSession();
      const t = data.session?.access_token ?? null;
      setAuthToken(t);
      setSupabaseJwt(t);
    }
    loadToken();
  }, []);

  // Load CodeCoach settings from your API (requires Authorization header)
  // NOTE: This is the ONLY place we load the CodeCoach app token.
  // The VS Code deep-link should NOT include geminiKey or codecoachToken.
  useEffect(() => {
    async function loadSettings() {
      if (!authToken) return;

      const res = await fetch("/api/me/codecoach", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) return;

      const json = await res.json();
      setGeminiKey(json?.geminiKey ?? "");
      setCodecoachToken(json?.token ?? "");
    }

    loadSettings();
  }, [authToken]);

  const vscodeLink = useMemo(() => {
    const extId = "anastasiakazanas.codecoach";
    const aId = encodeURIComponent(assignmentId);
    const cId = encodeURIComponent(courseId);

    // IMPORTANT:
    // - `token` on the deep link MUST be the Supabase JWT (so the extension can call /api/me/codecoach).
    // - Do NOT put geminiKey or codecoachToken in the URL.
    const jwt = encodeURIComponent(supabaseJwt ?? "");

    return (
      `vscode://${extId}/open?assignmentId=${aId}&courseId=${cId}` +
      (supabaseJwt ? `&token=${jwt}` : "")
    );
  }, [assignmentId, courseId, supabaseJwt]);

  const starterFiles: StarterFile[] = useMemo(() => {
    const bundle = asmt?.starter_bundle ?? asmt?.starterBundle;
    const files = bundle?.files;
    return Array.isArray(files) ? files : [];
  }, [asmt]);

  const singleZip = useMemo(() => {
    if (starterFiles.length !== 1) return null;
    const f = starterFiles[0];
    const looksZip =
      (f.filename || "").toLowerCase().endsWith(".zip") ||
      (f.path || "").toLowerCase().endsWith(".zip") ||
      (f.mime || "").includes("zip");
    return looksZip ? f : null;
  }, [starterFiles]);

  const tree = useMemo(() => buildTree(starterFiles), [starterFiles]);

    return (
    <RequireAuth>
      <AppShell title="Assignment">
        {err ? <div className="text-sm text-red-700">{err}</div> : null}

        {course && asmt ? (
          <div className="space-y-6">
            <div className="card p-6">
              <div className="text-xl font-bold">{asmt.title}</div>
              <div className="mt-1 text-sm text-black/60">{course.title}</div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  className="px-3 py-2 rounded-xl border border-black/10 hover:bg-black/5 transition"
                  onClick={() => router.push(`/student/course/${courseId}`)}
                >
                  Back to class
                </button>

                <div className="flex flex-col gap-1">
                  <a className="btn-primary w-fit" href={vscodeLink}>
                    Connect to VS Code
                  </a>
                  <div className="text-xs text-black/60">
                    {supabaseJwt ? "Student: signed in" : "Student: not signed in"}
                    {" • "}
                    {codecoachToken ? "CodeCoach token: ready" : "CodeCoach token: not ready"}
                    {" • "}
                    {geminiKey ? "Gemini key: ready" : "Gemini key: not set"}
                  </div>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <div className="text-sm font-semibold mb-2">Instructions</div>

              <div className="rounded-2xl border border-black/10 bg-white p-4 sm:p-6 overflow-x-auto">
                <div
                  className="prose max-w-none"
                  dangerouslySetInnerHTML={{
                    __html:
                      asmt?.instructions_html ??
                      asmt?.instructionsHtml ??
                      asmt?.instructions ??
                      "",
                  }}
                />
              </div>

              {(asmt?.tutorial_url ?? asmt?.tutorialUrl) ? (
                <div className="mt-4 text-sm">
                  Tutorial:{" "}
                  <a
                    className="underline"
                    href={asmt.tutorial_url ?? asmt.tutorialUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {asmt.tutorial_url ?? asmt.tutorialUrl}
                  </a>
                </div>
              ) : null}

              {starterFiles.length ? (
                <div className="mt-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold">Starter files</div>

                    <button
                      className="px-3 py-2 rounded-xl border border-black/10 hover:bg-black/5 transition text-sm"
                      onClick={() => {
                        if (singleZip) {
                          triggerDownload(singleZip.dataUrl, singleZip.filename);
                          return;
                        }
                        for (const f of starterFiles) {
                          triggerDownload(f.dataUrl, f.filename);
                        }
                      }}
                    >
                      {singleZip ? "Download zip" : "Download all"}
                    </button>
                  </div>

                  <div className="mt-3 rounded-2xl border border-black/10 bg-white p-4">
                    <TreeView node={tree} />
                    {!singleZip ? (
                      <div className="mt-3 text-xs text-black/50">
                        Note: “Download all” will download multiple files (one per file).
                        If you want a single .zip download, upload a zip as the starter bundle.
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="text-sm text-black/60">Loading…</div>
        )}
      </AppShell>
    </RequireAuth>
  );
}