import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

function supabaseAdminish() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
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

  const supabase = supabaseAdminish();

  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  const user = userData?.user;
  if (userErr || !user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_settings")
    .select("codecoach_token, gemini_api_key")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Ensure every user has a stable CodeCoach token (NOT the Supabase JWT)
  let codecoachToken = (data?.codecoach_token ?? "").toString().trim();

  if (!codecoachToken) {
    codecoachToken = randomUUID();

    const { error: upsertErr } = await supabase
      .from("user_settings")
      .upsert(
        {
          user_id: user.id,
          codecoach_token: codecoachToken,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 400 });
    }
  }

  return NextResponse.json({
    token: codecoachToken,
    geminiKey: (data?.gemini_api_key ?? "").toString(),
  });
}

export async function POST(req: Request) {
  const jwt = getBearer(req);
  if (!jwt) return NextResponse.json({ error: "Missing auth token" }, { status: 401 });

  const supabase = supabaseAdminish();

  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  const user = userData?.user;
  if (userErr || !user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json();

  const patch: Record<string, any> = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };

  if (typeof body?.geminiKey === "string") {
    patch.gemini_api_key = body.geminiKey.trim();
  }

  const { error } = await supabase.from("user_settings").upsert(patch, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}