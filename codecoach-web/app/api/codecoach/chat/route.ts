import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function callGemini(message: string, apiKey: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: message }],
          },
        ],
      }),
    }
  );

  const data = await res.json();

  console.log("Gemini response:", data);

  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text)
      .join("") ?? "No response"
  );
}

async function updateSessionSummary(sessionId: string, apiKey: string) {
  const { data: messages } = await supabase
    .from("messages")
    .select("role,content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (!messages || messages.length === 0) return;

  const transcript = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const summaryPrompt = `
Summarize the student's learning progress in this session.
Focus on concepts learned and difficulties.

${transcript}
`;

  const summary = await callGemini(summaryPrompt, apiKey);

  await supabase
    .from("sessions")
    .update({ summary })
    .eq("id", sessionId);
}

export async function POST(req: Request) {
  const { sessionId, message } = await req.json();

  if (!sessionId || !message) {
    return NextResponse.json(
      { error: "Missing sessionId or message" },
      { status: 400 }
    );
  }

  // get session
  const { data: session, error: sessionErr } = await supabase
    .from("sessions")
    .select("user_id")
    .eq("id", sessionId)
    .single();

  if (sessionErr || !session) {
    return NextResponse.json(
      { error: "Invalid session" },
      { status: 400 }
    );
  }

  // get student's Gemini key
  const { data: settings, error: settingsErr } = await supabase
    .from("user_settings")
    .select("gemini_api_key")
    .eq("user_id", session.user_id)
    .single();

  if (settingsErr || !settings?.gemini_api_key) {
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
    content: message,
  });

  // generate reply
  const reply = await callGemini(message, geminiKey);

  // save assistant message
  await supabase.from("messages").insert({
    session_id: sessionId,
    role: "assistant",
    content: reply,
  });

  // update learning summary
  await updateSessionSummary(sessionId, geminiKey);

  return NextResponse.json({ reply });
}