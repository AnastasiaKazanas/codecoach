import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

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
  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash"
  });

  const prompt = messages
    .map((m) => m.parts?.[0]?.text || "")
    .join("\n");

  const result = await model.generateContent(prompt);

  const response = await result.response;

  return response.text();
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

  try {
    const jwt = getBearer(req);

    if (!jwt) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    const user = userData?.user;

    if (userErr || !user) {
      return NextResponse.json({ error: "Invalid user" }, { status: 401 });
    }

    let body: any = {};

    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const sessionId = body.sessionId;
    const message = body.message;
    const systemPrompt = body.systemPrompt || "";
    const code = body.code || "";
    const cursorLine = body.cursorLine ?? null;

    if (!sessionId || !message) {
      return NextResponse.json(
        { error: "Missing sessionId or message" },
        { status: 400 }
      );
    }

    // get session
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
        console.error("Session insert error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
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

    // store user message
    await supabase.from("messages").insert({
      session_id: sessionId,
      role: "user",
      content: message
    });

    const { data: history } = await supabase
      .from("messages")
      .select("role,content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

  const geminiMessages = [
    {
      role: "user",
      parts: [{
        text: `${systemPrompt}

  Student message:
  ${message}

  Student cursor line:
  ${cursorLine}

  Student's current code:
  ${code}`
      }]
    },
    ...(history?.slice(0, -1).map((m: any) => ({
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

  } catch (err: any) {
    console.error("Chat route error:", err);

    return NextResponse.json(
      { error: err?.message || "Internal error" },
      { status: 500 }
    );
  }
}