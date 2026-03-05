import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function callGemini(message: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: message }] }],
      }),
    }
  );

  const data = await res.json();

  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text)
      .join("") ?? "No response"
  );
}

async function updateSessionSummary(sessionId: string) {
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

  const summary = await callGemini(summaryPrompt);

  await supabase
    .from("sessions")
    .update({ summary })
    .eq("id", sessionId);
}

export async function POST(req: Request) {
  const { sessionId, message } = await req.json();

  // save user message
  await supabase.from("messages").insert({
    session_id: sessionId,
    role: "user",
    content: message,
  });

  const reply = await callGemini(message);

  // save assistant message
  await supabase.from("messages").insert({
    session_id: sessionId,
    role: "assistant",
    content: reply,
  });

  // update session summary
  await updateSessionSummary(sessionId);

  return NextResponse.json({ reply });
}