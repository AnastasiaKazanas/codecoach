"use client";

import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getAssignment, getCourse } from "@/lib/db";

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
    // folders first
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

function TreeView({
  node,
  depth = 0,
}: {
  node: TreeNode;
  depth?: number;
}) {
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
  const params = useParams();
  const router = useRouter();

  const courseId = params.id as string;
  const assignmentId = decodeURIComponent(params.assignmentId as string);

  const [course, setCourse] = useState<any>(null);
  const [asmt, setAsmt] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const c = await getCourse(courseId);
        const a = await getAssignment(assignmentId);
        setCourse(c);
        setAsmt(a);
        setErr(null);
      } catch (e: any) {
        setErr(e.message ?? "Failed to load assignment.");
      }
    }

    load();
  }, [courseId, assignmentId]);

  const starterFiles: StarterFile[] = useMemo(() => {
    const files = asmt?.starterBundle?.files;
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

              <div className="mt-4">
                <button
                  className="px-3 py-2 rounded-xl border border-black/10 hover:bg-black/5 transition"
                  onClick={() => router.push(`/student/course/${courseId}`)}
                >
                  Back to class
                </button>
              </div>
            </div>

            <div className="card p-6">
              <div className="text-sm font-semibold mb-2">Instructions</div>

              <div className="rounded-2xl border border-black/10 bg-white p-4 sm:p-6 overflow-x-auto">
                <div
                  className="prose max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: asmt.instructionsHtml || asmt.instructions || "",
                  }}
                />
              </div>

              {asmt.tutorialUrl ? (
                <div className="mt-4 text-sm">
                  Tutorial:{" "}
                  <a
                    className="underline"
                    href={asmt.tutorialUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {asmt.tutorialUrl}
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
                        // If it's a single zip, download once.
                        if (singleZip) {
                          triggerDownload(singleZip.dataUrl, singleZip.filename);
                          return;
                        }

                        // Otherwise: browser-safe option = download each file.
                        // (To make a real zip client-side, you’d add a library like fflate/jszip.)
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