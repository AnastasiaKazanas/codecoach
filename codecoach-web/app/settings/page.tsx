"use client";

import AppShell from "@/components/AppShell";
import RequireAuth from "@/components/RequireAuth";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";


export default function SettingsPage() {
  const env = {
    AUTH: process.env.NEXT_PUBLIC_AUTH_API,
    COURSES: process.env.NEXT_PUBLIC_COURSES_API,
    ASSIGNMENTS: process.env.NEXT_PUBLIC_ASSIGNMENTS_API,
    SESSIONS: process.env.NEXT_PUBLIC_SESSIONS_API,
  };

  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const [token, setToken] = useState<string | null>(null);
  const [codecoachToken, setCodecoachToken] = useState("");

  const [geminiKey, setGeminiKey] = useState("");
  const [geminiSaved, setGeminiSaved] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
  async function loadToken() {
    const { data } = await supabase.auth.getSession();
    setToken(data.session?.access_token ?? null);
  }
  loadToken();
}, []);

  useEffect(() => {
    async function loadExisting() {
      if (!token) return;

      const res = await fetch("/api/me/codecoach", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;

      const json = await res.json();
      setGeminiKey(json?.geminiKey ?? "");
      setCodecoachToken(json?.token ?? "");
    }
    loadExisting();
  }, [token]);

  async function saveSettings() {
    setSaveMsg(null);

    if (!token) {
      setSaveMsg("Not signed in.");
      return;
    }

    const res = await fetch("/api/me/codecoach", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        geminiKey,
        token: codecoachToken,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      setSaveMsg(json?.error ?? "Failed to save");
      return;
    }

    setGeminiSaved(true);
    setTimeout(() => setGeminiSaved(false), 1200);
    setSaveMsg("Saved!");
  }

  async function onCopy() {
    if (!codecoachToken) return;
    await navigator.clipboard.writeText(codecoachToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <RequireAuth>
      <AppShell title="Settings">
        <div className="card p-6">
          <div className="text-xl font-bold">Settings</div>
          <div className="mt-1 text-sm text-black/60">
            API configuration (from .env.local)
          </div>

          {/* ✅ New: Token card */}
          <div className="mt-4 grid gap-3 text-sm">
            <div className="card p-4">
              <div className="font-semibold">Your CodeCoach Token</div>
              <div className="mt-1 text-black/60">
                This token is what gets passed to VS Code so the extension can connect your account.
              </div>

              {!codecoachToken ? (
                <div className="mt-3 text-red-600">
                  No CodeCoach token saved yet. Paste one below (or use your current login token) and click Save.
                </div>
              ) : (
                <>
                  <div className="mt-3 rounded-md border border-black/10 bg-black/5 p-3 font-mono text-xs break-all">
                    {revealed ? codecoachToken : (codecoachToken.length <= 16 ? "••••••••" : `${codecoachToken.slice(0, 8)}…${codecoachToken.slice(-6)}`)}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      className="px-3 py-1 rounded-md border border-black/10"
                      onClick={() => setRevealed((v) => !v)}
                      type="button"
                    >
                      {revealed ? "Hide" : "Reveal"}
                    </button>

                    <button
                      className="px-3 py-1 rounded-md border border-black/10"
                      onClick={onCopy}
                      type="button"
                    >
                      {copied ? "Copied!" : "Copy token"}
                    </button>
                  </div>

                  <input
                    className="mt-3 w-full rounded-md border border-black/10 bg-white px-3 py-2 font-mono text-xs"
                    placeholder="Paste your CodeCoach token..."
                    value={codecoachToken}
                    onChange={(e) => setCodecoachToken(e.target.value)}
                    type="password"
                  />

                  <div className="mt-3 flex gap-2">
                    <button
                      className="px-3 py-1 rounded-md border border-black/10"
                      type="button"
                      onClick={() => setCodecoachToken(token ?? "")}
                      disabled={!token}
                    >
                      Use my current login token
                    </button>

                    <button
                      className="px-3 py-1 rounded-md border border-black/10"
                      type="button"
                      onClick={() => setCodecoachToken("")}
                    >
                      Clear
                    </button>
                  </div>

                  <div className="mt-2 text-xs text-black/50">
                    Treat this like a password — don’t share it.
                  </div>
                </>
              )}
            </div>

            <div className="card p-4">
              <div className="font-semibold">Gemini API Key</div>
              <div className="mt-1 text-black/60">
                This is used by the VS Code extension to generate explanations and hints.
              </div>

              <input
                className="mt-3 w-full rounded-md border border-black/10 bg-white px-3 py-2 font-mono text-xs"
                placeholder="Paste your Gemini API key..."
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                type="password"
              />

              <div className="mt-3 flex gap-2">
                <button
                  className="px-3 py-1 rounded-md border border-black/10"
                  type="button"
                  onClick={saveSettings}
                >
                  {geminiSaved ? "Saved!" : "Save settings"}
                </button>

                <button
                  className="px-3 py-1 rounded-md border border-black/10"
                  type="button"
                  onClick={() => setGeminiKey("")}
                >
                  Clear
                </button>
              </div>

              {saveMsg ? (
                <div className="mt-2 text-xs text-black/60">{saveMsg}</div>
              ) : null}
            </div>
            

            {/* Existing API cards */}
            <div className="card p-4">
              <div className="font-semibold">Auth API</div>
              <div className="text-black/70">{env.AUTH}</div>
            </div>
            <div className="card p-4">
              <div className="font-semibold">Courses API</div>
              <div className="text-black/70">{env.COURSES}</div>
            </div>
            <div className="card p-4">
              <div className="font-semibold">Assignments API</div>
              <div className="text-black/70">{env.ASSIGNMENTS}</div>
            </div>
            <div className="card p-4">
              <div className="font-semibold">Sessions API</div>
              <div className="text-black/70">{env.SESSIONS}</div>
            </div>
          </div>
        </div>
      </AppShell>
    </RequireAuth>
  );
}