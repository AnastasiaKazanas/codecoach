import * as vscode from "vscode";
import { CodeCoachViewProvider } from "./codecoachView";

const GEMINI_KEY_NAME = "codecoach.geminiKey";
const AUTH_TOKEN_KEY = "codecoach.authToken";

// Separate API URLs (matches “separate APIs” idea)
const AUTH_API_URL_KEY = "codecoach.authApiUrl";
const COURSES_API_URL_KEY = "codecoach.coursesApiUrl";
const SESSIONS_API_URL_KEY = "codecoach.sessionsApiUrl";
const ASSIGNMENTS_API_URL_KEY = "codecoach.assignmentsApiUrl";

// -----------------------------
// In-memory chat history (session-only)
// -----------------------------
type ChatMsg = { role: "user" | "model"; text: string };
const chatHistory: ChatMsg[] = [];
const MAX_TURNS = 12;

// -----------------------------
// Persistent learning profile (overall, across sessions)
// -----------------------------
const PROFILE_KEY = "codecoach.learningProfile.v1";

type LearningProfile = {
  updatedAtISO: string;
  mastered: string[];
  developing: string[];
  topics: string[];
  notes?: string;
};

function uniq(arr: string[]) {
  return Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)));
}

function mergeProfiles(oldP: LearningProfile, newP: LearningProfile): LearningProfile {
  const mastered = uniq([...(oldP.mastered || []), ...(newP.mastered || [])]);
  const developingRaw = uniq([...(oldP.developing || []), ...(newP.developing || [])]);
  const developing = developingRaw.filter((x) => !mastered.includes(x));
  const topics = uniq([...(oldP.topics || []), ...(newP.topics || [])]);

  return {
    updatedAtISO: new Date().toISOString(),
    mastered,
    developing,
    topics,
    notes: newP.notes || oldP.notes,
  };
}

// -----------------------------
// Assignment + session types
// -----------------------------
type Assignment = {
  id: string;
  courseId: string;
  title: string;
  instructions: string;
  fundamentals: string[];
  objectives: string[];
};

type TraceEvent = {
  type: "chat_user" | "chat_model" | "checkpoint";
  ts: string;
  payload: any;
};

type ActiveSession = {
  assignmentId: string;
  sessionId: string;
  assignment: Assignment;
  traceBuffer: TraceEvent[]; // buffered events to send
};

let activeSession: ActiveSession | null = null;

// -----------------------------
// API helpers
// -----------------------------
function normalizeBaseUrl(url: string) {
  return url.trim().replace(/\/$/, "");
}

async function apiFetch<T>(
  context: vscode.ExtensionContext,
  baseKey: string,
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  const baseUrl = context.globalState.get<string>(baseKey);
  if (!baseUrl) throw new Error('API base URL not set. Run "CodeCoach: Set API Base URLs".');

  const token = await context.secrets.get(AUTH_TOKEN_KEY);

  const res = await fetch(`${baseUrl}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });

  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || data?.message || `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return data as T;
}

// -----------------------------
// Gemini helper
// -----------------------------
async function callGeminiGenerateContent(apiKey: string, prompt: string) {
  const modelName = "models/gemini-flash-latest";
  const url =
    `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent` +
    `?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3 },
    }),
  });

  const data: any = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message ?? JSON.stringify(data);
    throw new Error(`${res.status} ${msg}`);
  }

  return (
    data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).join("") ?? "No response."
  );
}

export function activate(context: vscode.ExtensionContext) {
  console.log("✅ CodeCoach activate() ran");

  let learningProfile: LearningProfile =
    context.globalState.get<LearningProfile>(PROFILE_KEY) || {
      updatedAtISO: new Date().toISOString(),
      mastered: [],
      developing: [],
      topics: [],
      notes: "",
    };

  let provider: CodeCoachViewProvider | null = null;

  // -----------------------------
  // Commands: Gemini key
  // -----------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand("codecoach.setApiKey", async () => {
      const key = await vscode.window.showInputBox({
        prompt: "Paste your Gemini API key (from Google AI Studio)",
        password: true,
        ignoreFocusOut: true,
      });
      if (!key) return;
      await context.secrets.store(GEMINI_KEY_NAME, key.trim());
      vscode.window.showInformationMessage("CodeCoach: Gemini API key saved.");
    })
  );

  // -----------------------------
  // Commands: API base URLs (4 APIs)
  // -----------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand("codecoach.setApiBaseUrls", async () => {
      const currentAuth = context.globalState.get<string>(AUTH_API_URL_KEY) || "http://localhost:4001";
      const currentCourses = context.globalState.get<string>(COURSES_API_URL_KEY) || "http://localhost:4002";
      const currentSessions = context.globalState.get<string>(SESSIONS_API_URL_KEY) || "http://localhost:4003";
      const currentAssignments = context.globalState.get<string>(ASSIGNMENTS_API_URL_KEY) || "http://localhost:4004";

      const authUrl = await vscode.window.showInputBox({
        prompt: "Auth API Base URL",
        value: currentAuth,
        ignoreFocusOut: true,
      });
      if (!authUrl) return;

      const coursesUrl = await vscode.window.showInputBox({
        prompt: "Courses API Base URL",
        value: currentCourses,
        ignoreFocusOut: true,
      });
      if (!coursesUrl) return;

      const sessionsUrl = await vscode.window.showInputBox({
        prompt: "Sessions API Base URL",
        value: currentSessions,
        ignoreFocusOut: true,
      });
      if (!sessionsUrl) return;

      const assignmentsUrl = await vscode.window.showInputBox({
        prompt: "Assignments API Base URL",
        value: currentAssignments,
        ignoreFocusOut: true,
      });
      if (!assignmentsUrl) return;

      await context.globalState.update(AUTH_API_URL_KEY, normalizeBaseUrl(authUrl));
      await context.globalState.update(COURSES_API_URL_KEY, normalizeBaseUrl(coursesUrl));
      await context.globalState.update(SESSIONS_API_URL_KEY, normalizeBaseUrl(sessionsUrl));
      await context.globalState.update(ASSIGNMENTS_API_URL_KEY, normalizeBaseUrl(assignmentsUrl));

      vscode.window.showInformationMessage("CodeCoach: API base URLs saved.");
      provider?.postStatus("Connected APIs set. Next: Connect account.");
    })
  );

  // -----------------------------
  // Commands: Connect account (paste token)
  // -----------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand("codecoach.connectAccount", async () => {
      const token = await vscode.window.showInputBox({
        prompt: "Paste your CodeCoach token (from the web app / auth API demo)",
        password: true,
        ignoreFocusOut: true,
      });
      if (!token) return;

      await context.secrets.store(AUTH_TOKEN_KEY, token.trim());
      vscode.window.showInformationMessage("CodeCoach: connected.");
      provider?.postStatus("Account connected ✅");
    })
  );

  // -----------------------------
  // Commands: Clear chat
  // -----------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand("codecoach.clearChat", async () => {
      chatHistory.length = 0;
      vscode.window.showInformationMessage("CodeCoach: chat cleared for this session.");
    })
  );

  // -----------------------------
  // Commands: Open assignment (fetch from assignments-api + start session on sessions-api)
  // -----------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand("codecoach.openAssignment", async () => {
      const assignmentId = await vscode.window.showInputBox({
        prompt: "Enter Assignment ID",
        ignoreFocusOut: true,
      });
      if (!assignmentId) return;

      // Assignment details come from api-assignments (4004)
      const assignment = await apiFetch<Assignment>(context, ASSIGNMENTS_API_URL_KEY, `/assignments/${assignmentId}`, {
        method: "GET",
      });

      // Session is created by api-sessions (4003)
      const started = await apiFetch<{ sessionId: string }>(context, SESSIONS_API_URL_KEY, `/sessions/start`, {
        method: "POST",
        body: JSON.stringify({ assignmentId }),
      });

      activeSession = {
        assignmentId,
        sessionId: started.sessionId,
        assignment,
        traceBuffer: [],
      };

      provider?.postStatus(`Active assignment: ${assignment.title}`);
      vscode.window.showInformationMessage(`CodeCoach: opened "${assignment.title}".`);

      await vscode.commands.executeCommand("codecoach.openChat");
    })
  );

  // -----------------------------
  // Commands: Export learning summary (session + overall)
  // -----------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand("codecoach.exportLearningSummary", async () => {
      const apiKey = await context.secrets.get(GEMINI_KEY_NAME);
      if (!apiKey) {
        vscode.window.showErrorMessage('No Gemini API key set. Run "CodeCoach: Set Gemini API Key".');
        return;
      }
      if (chatHistory.length === 0) {
        vscode.window.showWarningMessage("No chat history yet in this session.");
        return;
      }

      const transcript = chatHistory
        .map((m) => `${m.role === "user" ? "User" : "Coach"}: ${m.text}`)
        .join("\n");

      const overallProfileJson = JSON.stringify(learningProfile, null, 2);

      const summaryPrompt = `
You are producing a learning summary and a structured learning profile.

Return ONLY valid JSON matching this schema (no markdown, no extra keys):
{
  "session": {
    "topicsDiscussed": string[],
    "fundamentalsMastered": string[],
    "fundamentalsDeveloping": string[],
    "highlights": string[]
  },
  "overallUpdate": {
    "topics": string[],
    "mastered": string[],
    "developing": string[],
    "notes": string
  }
}

Rules:
- Be concise.
- "fundamentalsMastered" means the student demonstrated correct understanding or execution.
- "fundamentalsDeveloping" means confusion, errors, or incomplete understanding remains.
- Fundamentals should be generic skills (e.g., "Big-O reasoning", "state invariants", "JS async/await", "regex basics") not project-specific tasks.
- Avoid duplicates and keep items short.

OVERALL PROFILE SO FAR:
${overallProfileJson}

SESSION TRANSCRIPT:
${transcript}
`.trim();

      let parsed: any;
      try {
        const raw = await callGeminiGenerateContent(apiKey, summaryPrompt);
        parsed = JSON.parse(raw);
      } catch {
        vscode.window.showErrorMessage("Failed to export summary (model did not return valid JSON). Try again.");
        return;
      }

      const session = parsed?.session;
      const update = parsed?.overallUpdate;
      if (!session || !update) {
        vscode.window.showErrorMessage("Failed to export summary (missing expected fields).");
        return;
      }

      const newProfile: LearningProfile = {
        updatedAtISO: new Date().toISOString(),
        mastered: uniq(update.mastered || []),
        developing: uniq(update.developing || []),
        topics: uniq(update.topics || []),
        notes: (update.notes || "").toString(),
      };

      learningProfile = mergeProfiles(learningProfile, newProfile);
      await context.globalState.update(PROFILE_KEY, learningProfile);

      const md = `# CodeCoach Learning Summary

## Session Summary (this chat)
**Topics discussed**
${(session.topicsDiscussed || []).map((x: string) => `- ${x}`).join("\n") || "- (none)"}

**Fundamentals mastered (evidence shown)**
${(session.fundamentalsMastered || []).map((x: string) => `- ${x}`).join("\n") || "- (none)"}

**Fundamentals still developing**
${(session.fundamentalsDeveloping || []).map((x: string) => `- ${x}`).join("\n") || "- (none)"}

**Highlights**
${(session.highlights || []).map((x: string) => `- ${x}`).join("\n") || "- (none)"}

---

## Overall Learning Summary (to date)
_Last updated: ${learningProfile.updatedAtISO}_

**Topics covered**
${(learningProfile.topics || []).map((x) => `- ${x}`).join("\n") || "- (none)"}

**Fundamentals mastered to date**
${(learningProfile.mastered || []).map((x) => `- ${x}`).join("\n") || "- (none)"}

**Fundamentals still developing**
${(learningProfile.developing || []).map((x) => `- ${x}`).join("\n") || "- (none)"}

**Notes**
${learningProfile.notes?.trim() ? learningProfile.notes : "(none)"}
`;

      await vscode.env.clipboard.writeText(md);
      const doc = await vscode.workspace.openTextDocument({ content: md, language: "markdown" });
      await vscode.window.showTextDocument(doc, { preview: false });

      vscode.window.showInformationMessage("Learning summary exported (opened + copied to clipboard).");
    })
  );

  // -----------------------------
  // Commands: Submit learning process (trace + optional summary)
  // -----------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand("codecoach.submitLearningProcess", async () => {
      if (!activeSession) {
        vscode.window.showErrorMessage('No active assignment. Run "CodeCoach: Open Assignment" first.');
        return;
      }

      // Flush buffered events
      if (activeSession.traceBuffer.length > 0) {
        await apiFetch(context, SESSIONS_API_URL_KEY, `/sessions/${activeSession.sessionId}/events`, {
          method: "POST",
          body: JSON.stringify({ events: activeSession.traceBuffer }),
        });
        activeSession.traceBuffer = [];
      }

      // Export summary locally
      await vscode.commands.executeCommand("codecoach.exportLearningSummary");

      // Mark submitted on server
      await apiFetch(context, SESSIONS_API_URL_KEY, `/sessions/${activeSession.sessionId}/submit`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      vscode.window.showInformationMessage("Submitted learning process ✅ (events uploaded + session submitted).");
      provider?.postStatus(`Submitted: ${activeSession.assignment.title}`);
    })
  );

  // -----------------------------
  // Chat handler
  // -----------------------------
  const onUserMessage = async (userText: string, contextText: string): Promise<string> => {
    const apiKey = await context.secrets.get(GEMINI_KEY_NAME);
    if (!apiKey) throw new Error('No Gemini API key set. Run "CodeCoach: Set Gemini API Key".');

    // Save user's message in memory
    chatHistory.push({ role: "user", text: userText });

    // Trace event (assignment session)
    if (activeSession) {
      activeSession.traceBuffer.push({
        type: "chat_user",
        ts: new Date().toISOString(),
        payload: { text: userText },
      });
    }

    // Trim chat memory for coaching loop
    const maxMsgs = MAX_TURNS * 2;
    if (chatHistory.length > maxMsgs) chatHistory.splice(0, chatHistory.length - maxMsgs);

    const historyText = chatHistory
      .slice(0, -1)
      .map((m) => `${m.role === "user" ? "User" : "Coach"}: ${m.text}`)
      .join("\n");

    const MAX_CONTEXT_CHARS = 20_000;
    const safeContext =
      (contextText || "").length > MAX_CONTEXT_CHARS
        ? (contextText || "").slice(0, MAX_CONTEXT_CHARS) + "\n\n[Context truncated]"
        : (contextText || "");

    const assignmentContext = activeSession
      ? `
ACTIVE ASSIGNMENT
Title: ${activeSession.assignment.title}
Objectives: ${(activeSession.assignment.objectives || []).join("; ")}
Required fundamentals: ${(activeSession.assignment.fundamentals || []).join(", ")}

Instructions:
${activeSession.assignment.instructions}
`.trim()
      : "(no active assignment)";

    const instructions = `You are CodeCoach, a custom GPT whose purpose is to implement and follow the following specifications: support learning first, instead of providing solutions outright, engage students in conversation about what they are trying to achieve, explain the fundamentals required for the task, be a teaching presence and encourage thinking.

Primary interaction pattern:
- Coach by asking questions that help the user arrive at answers themselves.
- Keep it concise and not chatty.
- Default to exactly ONE question per message.

Code examples:
- Do NOT provide solution code for the student’s specific homework/task.
- Only provide toy examples that demonstrate the underlying concept.

Corrections:
- If the student is wrong, correct them briefly and ask them to restate in their own words.

Conversation continuity:
- Track what the user has already tried and avoid repeating questions.
`.trim();

    const prompt = `
${instructions}

${assignmentContext}

Conversation so far:
${historyText || "(none)"}

Relevant code context (from the user's editor):
${safeContext || "(no code context available)"}

User question:
${userText}
`.trim();

    const reply = await callGeminiGenerateContent(apiKey, prompt);

    chatHistory.push({ role: "model", text: reply });
    if (chatHistory.length > maxMsgs) chatHistory.splice(0, chatHistory.length - maxMsgs);

    if (activeSession) {
      activeSession.traceBuffer.push({
        type: "chat_model",
        ts: new Date().toISOString(),
        payload: { text: reply },
      });

      // auto-flush every ~10 events
      if (activeSession.traceBuffer.length >= 10) {
        await apiFetch(context, SESSIONS_API_URL_KEY, `/sessions/${activeSession.sessionId}/events`, {
          method: "POST",
          body: JSON.stringify({ events: activeSession.traceBuffer }),
        });
        activeSession.traceBuffer = [];
      }
    }

    return reply;
  };

  provider = new CodeCoachViewProvider(context, onUserMessage);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider("codecoach.chatView", provider));
  console.log("✅ registered provider for codecoach.chatView");

  context.subscriptions.push(
    vscode.commands.registerCommand("codecoach.openChat", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.codecoach");
      provider?.reveal();
    })
  );

  provider.postStatus("Tip: Set API URLs → Connect → Open assignment.");
}

export function deactivate() {}