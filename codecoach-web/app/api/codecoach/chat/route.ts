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

const DEFAULT_SYSTEM_PROMPT = `
You are CodeCoach, an expert programming tutor helping a student complete a programming assignment.

Your goal is to guide the student toward the solution without immediately giving the full answer.

Rules:
• If the student suggests a correct idea, acknowledge it clearly.
• Do NOT question correct reasoning.
• Ask only ONE follow-up question at a time.
• If the student is mostly correct, help refine their thinking.
• If the student struggles for multiple turns, provide a hint.
• Avoid repetitive questioning.

Formatting rules:
• When showing code or diagrams, always use triple backticks.
• Preserve spacing exactly for ASCII diagrams.
• Ensure diagrams match assignment instructions.

Tone:
• Friendly
• Encouraging
• Clear
• Concise
`;

async function callGemini(messages: any[], apiKey: string) {
  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash"
  });

  const result = await model.generateContent({
    contents: messages
  });

  const response = await result.response;

  return response.text();
}

async function updateSessionSummary(
  supabase: any,
  sessionId: string,
  apiKey: string
) {
  const { data: session } = await supabase
    .from("sessions")
    .select("id,user_id,assignment_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) return;

  const { data: messages } = await supabase
    .from("messages")
    .select("role,content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (!messages?.length) return;

  const transcript = messages
    .map((m: any) => `${m.role}: ${m.content}`)
    .join("\n");

  // ------------------------------------------------
  // 1️⃣ Generate session summary
  // ------------------------------------------------

  const summaryPrompt = `
Summarize the student's learning progress and key concepts they worked on.

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

  // ------------------------------------------------
  // 2️⃣ Evaluate assignment fundamentals
  // ------------------------------------------------

  if (!session.assignment_id) return;

  const { data: assignment } = await supabase
    .from("assignments")
    .select("fundamentals,course_id")
    .eq("id", session.assignment_id)
    .maybeSingle();

  if (!assignment?.fundamentals) return;

  const fundamentals = assignment.fundamentals;

  const conceptPrompt = `
You are evaluating a student's learning progress.

Assignment fundamentals:
${fundamentals.join("\n")}

Conversation:
${transcript}

Return ONLY valid JSON in this format:

{
 "mastered": [],
 "working_on": []
}

Rules:
• Only include concepts from the fundamentals list
• mastered = student clearly demonstrated understanding
• working_on = student attempted but not fully mastered
`;

  const conceptResponse = await callGemini(
    [
      {
        role: "user",
        parts: [{ text: conceptPrompt }]
      }
    ],
    apiKey
  );

  let parsed;

  try {
    parsed = JSON.parse(conceptResponse.replace(/```json|```/g, "").trim()
);
  } catch {
    parsed = { mastered: [], working_on: [] };
  }

  // ------------------------------------------------
  // 3️⃣ Update learning profile
  // ------------------------------------------------

  await supabase
    .from("learning_profiles")
    .upsert(
      {
        course_id: assignment.course_id,
        student_id: session.user_id,
        mastered: parsed.mastered || [],
        developing: parsed.working_on || [],
        topics: fundamentals,
        updated_at: new Date().toISOString()
      },
      { onConflict: "course_id,student_id" }
    );
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
    const systemPrompt = body.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    const code = body.code || "";
    const cursorLine = body.cursorLine ?? null;

    if (!sessionId || !message) {
      return NextResponse.json(
        { error: "Missing sessionId or message" },
        { status: 400 }
      );
    }

    // Ensure session exists
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
          user_id: user.id,
          assignment_id: body.assignmentId || null
        })
        .select()
        .single();

      if (error) {
        console.error("Session insert error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      session = created;
    }

    // Get Gemini key
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

    // Store user message
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

    const geminiMessages: any[] = [];

    // System prompt
    geminiMessages.push({
      role: "user",
      parts: [{ text: systemPrompt }]
    });

    // Conversation history
    if (history?.length) {
      for (const m of history || []) {
        geminiMessages.push({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }]
        });
      }
    }

    // Current student context
    geminiMessages.push({
      role: "user", 
      parts: [
        {
          text: `
Student message:
${message}

Student cursor line:
${cursorLine ?? "unknown"}

Student's current code:
${code || "No code provided"}
`
        }
      ]
    });

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