import { supabase } from "./supabase";

export async function getAuth() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function clearAuth() {
  await supabase.auth.signOut();
}

export function isNorthwesternEmail(email: string) {
  return email.endsWith("@u.northwestern.edu");
}

export async function getMyRole(): Promise<"student" | "instructor" | null> {
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;
  if (!email) return null;

  const { data: row, error } = await supabase
    .from("users")
    .select("role")
    .eq("email", email)
    .maybeSingle();

  if (error) throw error;
  return (row?.role as "student" | "instructor" | undefined) ?? null;
}