"use client";

import AppShell from "@/components/AppShell";
import RequireAuth from "@/components/RequireAuth";
import { supabase } from "@/lib/supabase";
import { useEffect, useMemo, useState } from "react";


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

useEffect(() => {
  async function load() {
    const { data } = await supabase.auth.getSession();
    setToken(data.session?.access_token ?? null);
  }
  load();
}, []);

  const maskedToken = useMemo(() => {
    if (!token) return "";
    if (token.length <= 16) return "••••••••";
    return `${token.slice(0, 8)}…${token.slice(-6)}`;
  }, [token]);

  async function onCopy() {
    if (!token) return;
    await navigator.clipboard.writeText(token);
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
                Paste this into the VS Code extension to connect your account.
              </div>

              {!token ? (
                <div className="mt-3 text-red-600">
                  No token found. Try logging out and logging back in.
                </div>
              ) : (
                <>
                  <div className="mt-3 rounded-md border border-black/10 bg-black/5 p-3 font-mono text-xs break-all">
                    {revealed ? token : maskedToken}
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

                  <div className="mt-2 text-xs text-black/50">
                    Treat this like a password — don’t share it.
                  </div>
                </>
              )}
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