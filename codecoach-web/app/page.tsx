"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isNorthwesternEmail, setAuth } from "@/lib/storage";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"student" | "instructor">("student");
  const [err, setErr] = useState<string | null>(null);

  function onLogin() {
    setErr(null);

    if (!isNorthwesternEmail(email)) {
      setErr("Please use your @u.northwestern.edu email.");
      return;
    }

    // MVP: accept any NU email, mint a local “token”
    setAuth({
      email: email.trim(),
      role,
      token: `dev-${Date.now()}`
    });

    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[#F6F4FA] p-10">
      <div className="mx-auto max-w-xl">
        <div className="card p-6">
          <div className="text-2xl font-bold" style={{ color: "var(--nu-purple)" }}>
            CodeCoach
          </div>
          <div className="mt-1 text-sm text-black/60">Northwestern academic workspace</div>

          <div className="mt-6">
            <label className="text-xs font-semibold text-black/70">Email</label>
            <input
              className="input mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@u.northwestern.edu"
            />
          </div>

          <div className="mt-4">
            <label className="text-xs font-semibold text-black/70">Role</label>
            <select className="input mt-1" value={role} onChange={(e) => setRole(e.target.value as any)}>
              <option value="student">Student</option>
              <option value="instructor">Instructor</option>
            </select>
          </div>

          {err ? <div className="mt-3 text-sm text-red-700">{err}</div> : null}

          <button className="btn-primary mt-5 w-full" onClick={onLogin}>
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}