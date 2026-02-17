"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import { getAuth } from "@/lib/storage";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth();
    if (!auth) return;
    router.replace(auth.role === "student" ? "/student" : "/instructor");
  }, [router]);

  return (
    <RequireAuth>
      <div className="text-sm text-black/60">Loading…</div>
    </RequireAuth>
  );
}