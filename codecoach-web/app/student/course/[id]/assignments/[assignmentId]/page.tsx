"use client";

import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  getAssignment,
  getCourse,
  getStarterZipSignedUrl,
} from "@/lib/db";
import { supabase } from "@/lib/supabase";

/* ---------------- Utilities ---------------- */

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

function triggerDownload(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename || "download";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* ---------------- Component ---------------- */

export default function StudentAssignmentDetailPage() {
  const params = useParams<{ id: string; assignmentId: string }>();
  const router = useRouter();

  const courseId = params?.id;
  const assignmentId = params?.assignmentId
    ? decodeURIComponent(params.assignmentId)
    : "";

  const [course, setCourse] = useState<any>(null);
  const [asmt, setAsmt] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const [supabaseJwt, setSupabaseJwt] = useState<string | null>(null);
  const [codecoachToken, setCodecoachToken] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [authToken, setAuthToken] = useState<string | null>(null);

  /* ---------- Load Course + Assignment ---------- */

  useEffect(() => {
    async function load() {
      try {
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

  /* ---------- Load Supabase JWT ---------- */

  useEffect(() => {
    async function loadToken() {
      const { data } = await supabase.auth.getSession();
      const t = data.session?.access_token ?? null;
      setAuthToken(t);
      setSupabaseJwt(t);
    }
    loadToken();
  }, []);

  /* ---------- Load CodeCoach Settings ---------- */

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

  /* ---------- VS Code Deep Link ---------- */

  const vscodeLink = useMemo(() => {
    const extId = "anastasiakazanas.codecoach";
    const aId = encodeURIComponent(assignmentId);
    const cId = encodeURIComponent(courseId);
    const jwt = encodeURIComponent(supabaseJwt ?? "");

    return (
      `vscode://${extId}/open?assignmentId=${aId}&courseId=${cId}` +
      (supabaseJwt ? `&token=${jwt}` : "")
    );
  }, [assignmentId, courseId, supabaseJwt]);

  /* ---------- Derived Data ---------- */

  const fundamentals = useMemo(
    () => safeArray(asmt?.fundamentals),
    [asmt]
  );

  const objectives = useMemo(
    () => safeArray(asmt?.objectives),
    [asmt]
  );

  const starterZipPath = useMemo(() => {
    if (!asmt?.starter_bundle) return null;

    let bundle: any = null;

    if (typeof asmt.starter_bundle === "string") {
      try {
        bundle = JSON.parse(asmt.starter_bundle);
      } catch {
        return null;
      }
    } else {
      bundle = asmt.starter_bundle;
    }

    if (!bundle?.zipPath) return null;
    if (!bundle.zipPath.trim()) return null;

    return bundle.zipPath;
  }, [asmt]);

  /* ---------- Render ---------- */

  return (
    <RequireAuth>
      <AppShell title="Assignment">
        {err && <div className="text-sm text-red-700">{err}</div>}

        {course && asmt ? (
          <div className="space-y-6">

            {/* Header Card */}
            <div className="card p-6">
              <div className="text-xl font-bold">{asmt.title}</div>
              <div className="mt-1 text-sm text-black/60">
                {course.title}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">

                <button
                  className="px-3 py-2 rounded-xl border border-black/10 hover:bg-black/5"
                  onClick={() =>
                    router.push(`/student/course/${courseId}`)
                  }
                >
                  Back to class
                </button>

                {/* CONNECT TO VSCODE RESTORED */}
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

            {/* Instructions */}
            <div className="card p-6">
              <div className="text-sm font-semibold mb-2">
                Instructions
              </div>

              <div
                className="prose max-w-none"
                dangerouslySetInnerHTML={{
                  __html:
                    asmt.instructions_html ??
                    asmt.instructions ??
                    "",
                }}
              />
            </div>

            {/* Learning Goals Card */}
            {(fundamentals.length > 0 ||
              objectives.length > 0 ||
              asmt?.tutorial_url ||
              starterZipPath) && (
              <div className="card p-6 space-y-6">

                {fundamentals.length > 0 && (
                  <div>
                    <div className="text-lg font-semibold mb-2">
                      Fundamentals
                    </div>
                    <ul className="list-disc ml-6 space-y-1">
                      {fundamentals.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {objectives.length > 0 && (
                  <div>
                    <div className="text-lg font-semibold mb-2">
                      Objectives
                    </div>
                    <ul className="list-disc ml-6 space-y-1">
                      {objectives.map((o, i) => (
                        <li key={i}>{o}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {asmt?.tutorial_url && (
                  <div>
                    <div className="text-lg font-semibold mb-2">
                      Tutorial
                    </div>
                    <a
                      href={asmt.tutorial_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-700 underline"
                    >
                      Open Tutorial
                    </a>
                  </div>
                )}

                {starterZipPath && (
                  <div>
                    <div className="text-lg font-semibold mb-2">
                      Starter Files
                    </div>
                    <button
                      className="btn-primary"
                      onClick={async () => {
                        const url =
                          await getStarterZipSignedUrl(
                            starterZipPath
                          );
                        window.open(url, "_blank");
                      }}
                    >
                      Download Starter Zip
                    </button>
                  </div>
                )}

              </div>
            )}

          </div>
        ) : (
          <div className="text-sm text-black/60">
            Loading…
          </div>
        )}
      </AppShell>
    </RequireAuth>
  );
}