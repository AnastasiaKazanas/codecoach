"use client";

import AppShell from "@/components/AppShell";
import RequireAuth from "@/components/RequireAuth";

export default function SettingsPage() {
  const env = {
    AUTH: process.env.NEXT_PUBLIC_AUTH_API,
    COURSES: process.env.NEXT_PUBLIC_COURSES_API,
    ASSIGNMENTS: process.env.NEXT_PUBLIC_ASSIGNMENTS_API,
    SESSIONS: process.env.NEXT_PUBLIC_SESSIONS_API,
  };

  return (
    <RequireAuth>
      <AppShell>
        <div className="card p-6">
          <div className="text-xl font-bold">Settings</div>
          <div className="mt-1 text-sm text-black/60">API configuration (from .env.local)</div>

          <div className="mt-4 grid gap-3 text-sm">
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