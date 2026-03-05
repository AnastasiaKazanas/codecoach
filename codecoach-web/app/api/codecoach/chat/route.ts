import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
        generationConfig: {
          temperature: 0.4
        }
      })
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
Summarize the student's learning progress in this tutoring session.
Focus on:
- Concepts learned
- Misconceptions
- Skills practiced

Conversation:
${transcript}
`;

  const summaryMessages = [
    {
      role: "user",
      parts: [{ text: summaryPrompt }]
    }
  ];

  const summary = await callGemini(summaryMessages, apiKey);

  await supabase
    .from("sessions")
    .update({ summary })
    .eq("id", sessionId);
}

export async function POST(req: Request) {
  const { sessionId, message, systemPrompt } = await req.json();

  if (!sessionId || !message) {
    return NextResponse.json(
      { error: "Missing sessionId or message" },
      { status: 400 }
    );
  }

  let { data: session } = await supabase
    .from("sessions")
    .select("user_id")
    .eq("id", sessionId)
    .single();

  if (!session) {
    const created = await supabase
      .from("sessions")
      .insert({
        id: sessionId,
        user_id: "dev-user"
      })
      .select()
      .single();

    session = created.data;
  }

  if (!session) throw new Error("Failed to create session");

  const { data: settings } = await supabase
    .from("user_settings")
    .select("gemini_api_key")
    .eq("user_id", session.user_id)
    .single();

  if (!settings?.gemini_api_key) {
    return NextResponse.json(
      { error: "Student has not configured a Gemini API key" },
      { status: 400 }
    );
  }

  const geminiKey = settings.gemini_api_key;

  // Save user message
  await supabase.from("messages").insert({
    session_id: sessionId,
    role: "user",
    content: message
  });

  // Load full conversation history
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
    ...(history?.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    })) ?? [])
  ];

  // Call Gemini with full context
  const reply = await callGemini(geminiMessages, geminiKey);

  // Save assistant reply
  await supabase.from("messages").insert({
    session_id: sessionId,
    role: "assistant",
    content: reply
  });

  // Update tutoring summary
  await updateSessionSummary(sessionId, geminiKey);

  return NextResponse.json({ reply });
}