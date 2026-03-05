import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/* -----------------------------
   GEMINI CALL
----------------------------- */

async function callGemini(prompt: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
        },
      }),
    }
  );

  const data = await res.json();

  console.log("Gemini response:", JSON.stringify(data, null, 2));

  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p?.text ?? "")
      .join("") ||
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    data?.candidates?.[0]?.output ||
    null;

  return text ?? "No response";
}

/* -----------------------------
   SESSION SUMMARY
----------------------------- */

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

Focus on:
• concepts learned
• misconceptions
• areas of difficulty

Conversation:
${transcript}
`;

  const summary = await callGemini(summaryPrompt);

  await supabase
    .from("sessions")
    .update({ summary })
    .eq("id", sessionId);
}


export async function POST(req: Request) {
  try {
    const body = await req.json();

    const sessionId = body?.sessionId;
    const message = body?.message;

    if (!sessionId || !message) {
      return NextResponse.json(
        { error: "Missing sessionId or message" },
        { status: 400 }
      );
    }

    // ensure session exists
    await supabase.from("sessions").upsert({
      id: sessionId,
      updated_at: new Date().toISOString(),
    });

    // save user message
    await supabase.from("messages").insert({
      session_id: sessionId,
      role: "user",
      content: message,
    });

    const prompt = `
You are CodeCoach, an AI programming tutor.

Guide the student instead of giving answers.
Ask one question per response.
Never provide full solutions.

Student message:
${message}
`;

    const reply = await callGemini(prompt);

    // save assistant message
    await supabase.from("messages").insert({
      session_id: sessionId,
      role: "assistant",
      content: reply,
    });

    await updateSessionSummary(sessionId);

    return NextResponse.json({ reply });

  } catch (err: any) {
    console.error("CHAT API ERROR:", err);

    return NextResponse.json(
      { error: err.message ?? "Server error" },
      { status: 500 }
    );
  }
}