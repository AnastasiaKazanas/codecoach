import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

async function callGemini(messages: any[], apiKey: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: messages,
        generationConfig: { temperature: 0.4 }
      })
    }
  );

  const data = await res.json();

  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text)
      .join("") ?? "No response"
  );
}

async function updateSessionSummary(
  supabase: any,
  sessionId: string,
  apiKey: string
) {
  const { data: messages } = await supabase
    .from("messages")
    .select("role,content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (!messages?.length) return;

  const transcript = messages
    .map((m: any) => `${m.role}: ${m.content}`)
    .join("\n");

  const summaryPrompt = `
Summarize the student's learning progress.

Conversation:
${transcript}
`;

  const summary = await callGemini(
    [
      {
        role: "user",
        parts: [{ text: summaryPrompt }]
      }
    ],
    apiKey
  );

  await supabase
    .from("sessions")
    .update({ summary })
    .eq("id", sessionId);
}

export async function POST(req: Request) {
  const supabase = supabaseAdmin();

  const jwt = getBearer(req);
  if (!jwt) {
    return NextResponse.json(
      { error: "Missing auth token" },
      { status: 401 }
    );
  }

  const { data: userData } = await supabase.auth.getUser(jwt);
  const user = userData?.user;

  if (!user) {
    return NextResponse.json(
      { error: "Invalid user" },
      { status: 401 }
    );
  }

  const { sessionId, message, systemPrompt } = await req.json();

  if (!sessionId || !message) {
    return NextResponse.json(
      { error: "Missing sessionId or message" },
      { status: 400 }
    );
  }

  // get or create session
  let { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) {
    const { data: created, error } = await supabase
      .from("sessions")
      .insert({
        id: sessionId,
        user_id: user.id
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    session = created;
  }

  // get gemini key
  const { data: settings } = await supabase
    .from("user_settings")
    .select("gemini_api_key")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!settings?.gemini_api_key) {
    return NextResponse.json(
      { error: "Student has not configured a Gemini API key" },
      { status: 400 }
    );
  }

  const geminiKey = settings.gemini_api_key;

  // save user message
  await supabase.from("messages").insert({
    session_id: sessionId,
    role: "user",
    content: message
  });

  // load history
  const { data: history } = await supabase
    .from("messages")
    .select("role,content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const geminiMessages = [
    {
      role: "user",
      parts: [{ text: systemPrompt }]
    },
    ...(history?.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    })) ?? [])
  ];

  const reply = await callGemini(geminiMessages, geminiKey);

  await supabase.from("messages").insert({
    session_id: sessionId,
    role: "assistant",
    content: reply
  });

  await updateSessionSummary(supabase, sessionId, geminiKey);

  return NextResponse.json({ reply });
}