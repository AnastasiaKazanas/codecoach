"use client";

import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { useEffect, useState } from "react";
import { getCurrentUser, getLearningProfile } from "@/lib/db";

export default function StudentOverallProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setErr(null);
        setLoading(true);

        const user = await getCurrentUser();
        if (!user?.email) {
          setErr("Not signed in.");
          return;
        }

        const p = await getLearningProfile(user.email);
        setProfile(p); // p can be null if no row yet
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load profile.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <RequireAuth>
      <AppShell title="My Profile">
        {loading ? <div className="text-sm text-black/60">Loading…</div> : null}
        {err ? <div className="text-sm text-red-700">{err}</div> : null}

        {!loading && !err ? (
          profile ? (
            <div className="card p-6">
              <div className="text-sm font-semibold">Profile loaded ✅</div>
              {/* render your mastered/developing/topics safely here */}
            </div>
          ) : (
            <div className="card p-6">
              <div className="text-sm text-black/70">
                No profile yet (this is normal until you generate one).
              </div>
            </div>
          )
        ) : null}
      </AppShell>
    </RequireAuth>
  );
}