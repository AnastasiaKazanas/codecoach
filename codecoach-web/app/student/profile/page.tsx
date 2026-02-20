"use client";

import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { useEffect, useState } from "react";
import { getCurrentUser, getLearningProfile } from "@/lib/db";

export default function StudentOverallProfilePage() {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser();
      if (!user?.email) return;

      const data = await getLearningProfile(user.email);
      setProfile(data?.data ?? null);
    }

    load();
  }, []);

  return (
    <RequireAuth>
      <AppShell title="My Profile">
        <div className="card p-6">
          <div className="text-xl font-bold mb-4">Overall Learning Profile</div>

          {profile ? (
            <pre className="text-sm bg-gray-100 p-4 rounded-xl overflow-x-auto">
              {JSON.stringify(profile, null, 2)}
            </pre>
          ) : (
            <div>No profile yet.</div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}