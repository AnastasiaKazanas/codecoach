function errMsg(e: unknown) {
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object") {
    // Supabase errors often look like { message, details, hint, code }
    const anyE = e as any;
    return anyE.message || JSON.stringify(anyE);
  }
  return "Unknown error";
}