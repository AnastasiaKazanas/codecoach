"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import { getAuth } from "@/lib/storage";
import { supabase } from "@/lib/supabase";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const user = await getAuth();
      if (!user?.email) return;

      const { data } = await supabase
        .from("users")
        .select("role")
        .eq("email", user.email)
        .single();

      const role = data?.role;

      router.replace(role === "student" ? "/student" : "/instructor");
    }

    load();
  }, [router]);

  return (
    <RequireAuth>
      <div className="text-sm text-black/60">Loading…</div>
    </RequireAuth>
  );
}