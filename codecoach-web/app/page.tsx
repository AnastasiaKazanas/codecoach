"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

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

      // optional: route based on role stored in your public.users table
      // simplest MVP: just send to dashboard and let dashboard redirect
      router.replace("/dashboard");
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
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
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