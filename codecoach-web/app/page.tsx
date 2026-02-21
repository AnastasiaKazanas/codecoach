"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { ensureAppUser } from "@/lib/db";

type Role = "student" | "instructor";

// simple “system” rule if the user row doesn’t exist yet
function defaultRoleForEmail(email: string): Role {
  const e = email.toLowerCase();
  if (e.startsWith("instructor@")) return "instructor";
  return "student";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onLogin() {
    try {
      setErr(null);
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      const signedInEmail = data.user?.email?.trim();
      if (!signedInEmail) throw new Error("Signed in, but missing email.");

      // 1) Try to read role from public.users
      const { data: existing, error: selErr } = await supabase
        .from("users")
        .select("role")
        .eq("email", signedInEmail)
        .maybeSingle();

      // 2) If no row yet, create it once (auto role OR whatever you want)
      const role: Role =
        (existing?.role as Role | undefined) ?? defaultRoleForEmail(signedInEmail);

      // ensure row exists + updated
      await ensureAppUser(role);

      // 3) Route based on role
      router.replace(role === "instructor" ? "/instructor" : "/student");
    } catch (e: any) {
      setErr(e?.message ?? "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F6FB] p-6">
      <div className="card p-6 w-full max-w-md space-y-4">
        <div className="text-2xl font-extrabold">CodeCoach</div>

        <div className="grid gap-2">
          <div className="text-sm font-semibold">Email</div>
          <input
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <div className="text-sm font-semibold">Password</div>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {err ? <div className="text-sm text-red-700">{err}</div> : null}

        <button className="btn-primary w-full" disabled={loading} onClick={onLogin}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </div>
    </div>
  );
}