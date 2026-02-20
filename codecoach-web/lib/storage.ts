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

export async function setAuth() {
  // no longer needed (Supabase handles auth)
  return;
}