export type Role = "student" | "instructor";

export type AuthState = {
  token: string; // for MVP this can be a fake token
  role: Role;
  email: string;
};

const KEY = "codecoach.auth.v1";

export function getAuth(): AuthState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthState;
  } catch {
    return null;
  }
}

export function setAuth(state: AuthState) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function clearAuth() {
  localStorage.removeItem(KEY);
}

export function isNorthwesternEmail(email: string) {
  const e = email.trim().toLowerCase();
  return e.endsWith("@u.northwestern.edu");
}