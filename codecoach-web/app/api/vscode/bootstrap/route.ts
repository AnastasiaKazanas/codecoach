import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function supabaseAdminish() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!; // server-only
  return createClient(url, service, { auth: { persistSession: false } });
}

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

export async function GET(req: Request) {
  const jwt = getBearer(req);
  if (!jwt) return NextResponse.json({ error: "Missing auth token" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const assignmentId = searchParams.get("assignmentId");
  if (!assignmentId) {
    return NextResponse.json({ error: "Missing assignmentId" }, { status: 400 });
  }

  const supabase = supabaseAdminish();

  // Validate user from the JWT
  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  const user = userData?.user;
  if (userErr || !user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Fetch keys/tokens (optional; can be empty)
  const { data: settings, error: settingsErr } = await supabase
    .from("user_settings")
    .select("gemini_api_key, codecoach_token")
    .eq("user_id", user.id)
    .maybeSingle();

  if (settingsErr) {
    return NextResponse.json({ error: settingsErr.message }, { status: 400 });
  }

  // Fetch assignment (this mirrors your existing assignment route)
  const { data: assignment, error: asmtErr } = await supabase
    .from("assignments")
    .select(
      "id, course_id, title, instructions, instructions_html, fundamentals, objectives, tutorial_url, starter_bundle"
    )
    .eq("id", assignmentId)
    .single();

  if (asmtErr) {
    return NextResponse.json({ error: asmtErr.message }, { status: 400 });
  }

  let starter: { zipUrl: string; open: string[] } | null = null;

  try {
    let sb: any = assignment?.starter_bundle;

    // Handle JSON string case
    if (typeof sb === "string") {
      try {
        sb = JSON.parse(sb);
      } catch {
        sb = null;
      }
    }

    const zipPath =
      sb && typeof sb === "object" && typeof sb.zipPath === "string"
        ? sb.zipPath.trim()
        : "";

    const open =
      sb && typeof sb === "object" && Array.isArray(sb.open)
        ? sb.open
        : [];

    if (zipPath) {
      const { data: signed, error: signedErr } = await supabase
        .storage
        .from("starter-zips")
        .createSignedUrl(zipPath, 60 * 15);

      if (signedErr) {
        console.error("Signed URL error:", signedErr);
      } else if (signed?.signedUrl) {
        starter = {
          zipUrl: signed.signedUrl,
          open,
        };
      }
    }
  } catch (e) {
    console.error("Starter bootstrap error:", e);
    starter = null;
  }

  return NextResponse.json({
    geminiKey: settings?.gemini_api_key ?? "",
    token: settings?.codecoach_token ?? "",
    codecoachToken: settings?.codecoach_token ?? "",
    assignment,
    starter,
  });
}