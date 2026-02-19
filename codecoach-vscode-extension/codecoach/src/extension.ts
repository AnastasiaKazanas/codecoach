import * as vscode from "vscode";
import { CodeCoachViewProvider } from "./codecoachView";
import { MOCK_ASSIGNMENTS, Assignment as MockAssignment } from "./mockData";

const GEMINI_KEY_NAME = "codecoach.geminiKey";
const AUTH_TOKEN_KEY = "codecoach.authToken";

// (kept for later / optional)
const AUTH_API_URL_KEY = "codecoach.authApiUrl";
const COURSES_API_URL_KEY = "codecoach.coursesApiUrl";
const SESSIONS_API_URL_KEY = "codecoach.sessionsApiUrl";
const ASSIGNMENTS_API_URL_KEY = "codecoach.assignmentsApiUrl";

// In-memory chat history (session-only)
type ChatMsg = { role: "user" | "model"; text: string };
const chatHistory: ChatMsg[] = [];
const MAX_TURNS = 12;

// Persistent learning profile (overall, across sessions)
const PROFILE_KEY = "codecoach.learningProfile.v1";

type LearningProfile = {
  updatedAtISO: string;
  mastered: string[];
  developing: string[];
  topics: string[];
  notes?: string;
};

function isDemoMode(): boolean {
  return vscode.workspace.getConfiguration().get<boolean>("codecoach.demoMode", true);
}

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
    notes: newP.notes || oldP.notes
  };
}

function normalizeBaseUrl(url: string) {
  return url.trim().replace(/\/$/, "");
}

// Gemini helper
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
      generationConfig: { temperature: 0.3 }
    })
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

// Trace + active session (demo mode only uses local buffers)
type TraceEvent = {
  type: "chat_user" | "chat_model" | "checkpoint";
  ts: string;
  payload: any;
};

type ActiveSession = {
  assignmentId: string;
  sessionId: string; // local demo id
  assignment: MockAssignment;
  traceBuffer: TraceEvent[];
  submitted: boolean;
};

let activeSession: ActiveSession | null = null;

export function activate(context: vscode.ExtensionContext) {
  console.log("CodeCoach activate() ran");

  let learningProfile: LearningProfile =
    context.globalState.get<LearningProfile>(PROFILE_KEY) || {
      updatedAtISO: new Date().toISOString(),
      mastered: [],
      developing: [],
      topics: [],
      notes: ""
    };

  let provider: CodeCoachViewProvider | null = null;

  // ----------------------------
  // Command: Set Gemini API key
  // ----------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand("codecoach.setApiKey", async () => {
      const key = await vscode.window.showInputBox({
        prompt: "Paste your Gemini API key (from Google AI Studio)",
        password: true,
        ignoreFocusOut: true
      });
      if (!key) return;
      await context.secrets.store(GEMINI_KEY_NAME, key.trim());
      vscode.window.showInformationMessage("CodeCoach: Gemini API key saved.");
    })
  );

  // ---------------------------------------
  // Command: Set API base URLs (optional)
  // ---------------------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand("codecoach.setApiBaseUrls", async () => {
      if (isDemoMode()) {
        vscode.window.showInformationMessage("CodeCoach: Demo mode is ON — API URLs are not needed.");
        provider?.postStatus("Demo mode: using mock data (no APIs).");
        return;
      }

      const currentAuth = context.globalState.get<string>(AUTH_API_URL_KEY) || "http://localhost:4001";
      const currentCourses = context.globalState.get<string>(COURSES_API_URL_KEY) || "http://localhost:4002";
      const currentSessions = context.globalState.get<string>(SESSIONS_API_URL_KEY) || "http://localhost:4003";
      const currentAssignments = context.globalState.get<string>(ASSIGNMENTS_API_URL_KEY) || "http://localhost:4004";

      const authUrl = await vscode.window.showInputBox({
        prompt: "Auth API Base URL",
        value: currentAuth,
        ignoreFocusOut: true
      });
      if (!authUrl) return;

      const coursesUrl = await vscode.window.showInputBox({
        prompt: "Courses API Base URL",
        value: currentCourses,
        ignoreFocusOut: true
      });
      if (!coursesUrl) return;

      const sessionsUrl = await vscode.window.showInputBox({
        prompt: "Sessions API Base URL",
        value: currentSessions,
        ignoreFocusOut: true
      });
      if (!sessionsUrl) return;

      const assignmentsUrl = await vscode.window.showInputBox({
        prompt: "Assignments API Base URL",
        value: currentAssignments,
        ignoreFocusOut: true
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

  // ---------------------------------------
  // Command: Connect account (paste token)
  // (demo: optional / cosmetic)
  // ---------------------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand("codecoach.connectAccount", async () => {
      const token = await vscode.window.showInputBox({
        prompt: "Paste your CodeCoach token (demo: any string works)",
        password: true,
        ignoreFocusOut: true
      });
      if (!token) return;

      await context.secrets.store(AUTH_TOKEN_KEY, token.trim());
      vscode.window.showInformationMessage("CodeCoach: connected.");
      provider?.postStatus("Account connected");
    })
  );

  // ----------------------------
  // Command: Clear chat (session)
  // ----------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand("codecoach.clearChat", async () => {
      chatHistory.length = 0;
      vscode.window.showInformationMessage("CodeCoach: chat cleared for this session.");
      provider?.postStatus(activeSession ? `Active assignment: ${activeSession.assignment.title}` : "Chat cleared.");
    })
  );

  // ----------------------------
  // Command: Open assignment
  // Demo mode: QuickPick mock assignments
  // ----------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand("codecoach.openAssignment", async () => {
      if (isDemoMode()) {
        const pick = await vscode.window.showQuickPick(
          MOCK_ASSIGNMENTS.map((a) => ({
            label: a.title,
            description: `${a.courseId} • ${a.id}`,
            detail: `Fundamentals: ${a.fundamentals.join(", ")}`,
            assignmentId: a.id
          })),
          { placeHolder: "Pick an assignment (demo mode)" }
        );

        if (!pick) return;

        const assignment = MOCK_ASSIGNMENTS.find((x) => x.id === pick.assignmentId);
        if (!assignment) return;

        const sessionId = `demo-${Date.now()}`;

        activeSession = {
          assignmentId: assignment.id,
          sessionId,
          assignment,
          traceBuffer: [],
          submitted: false
        };

        provider?.postStatus(`Active assignment: ${assignment.title}`);
        vscode.window.showInformationMessage(`CodeCoach (demo): opened "${assignment.title}".`);
        await vscode.commands.executeCommand("codecoach.openChat");
        return;
      }

      // Real mode placeholder (optional)
      vscode.window.showErrorMessage("Real mode is not set up. Turn on CodeCoach: Demo Mode in settings.");
    })
  );

  // ----------------------------
  // Command: Export learning summary
  // (same behavior as before)
  // ----------------------------
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
        notes: (update.notes || "").toString()
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

  // ----------------------------
  // Command: Submit learning process
  // Demo mode: local submit (no upload)
  // ----------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand("codecoach.submitLearningProcess", async () => {
      if (!activeSession) {
        vscode.window.showErrorMessage('No active assignment. Run "CodeCoach: Open Assignment" first.');
        return;
      }

      // In demo mode, submission is local:
      // 1) export summary
      // 2) mark submitted
      await vscode.commands.executeCommand("codecoach.exportLearningSummary");
      activeSession.submitted = true;

      vscode.window.showInformationMessage(`Submitted (demo): ${activeSession.assignment.title}`);
      provider?.postStatus(`Submitted (demo): ${activeSession.assignment.title}`);
    })
  );

  // ----------------------------
  // Chat handler (same as before, but no apiFetch flushes)
  // ----------------------------
  const onUserMessage = async (userText: string, contextText: string): Promise<string> => {
    const apiKey = await context.secrets.get(GEMINI_KEY_NAME);
    if (!apiKey) throw new Error('No Gemini API key set. Run "CodeCoach: Set Gemini API Key".');

    // Save user's message in memory
    chatHistory.push({ role: "user", text: userText });

    // Trace event
    if (activeSession) {
      activeSession.traceBuffer.push({
        type: "chat_user",
        ts: new Date().toISOString(),
        payload: { text: userText }
      });
    }

    // Trim chat memory
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

    const instructions = `You are CodeCoach, a custom GPT whose purpose is to support learning first, instead of providing solutions outright.

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
        payload: { text: reply }
      });
    }

    return reply;
  };

  // ----------------------------
  // Webview provider + Open Chat
  // ----------------------------
  provider = new CodeCoachViewProvider(context, onUserMessage);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider("codecoach.chatView", provider));
  console.log("registered provider for codecoach.chatView");

  context.subscriptions.push(
    vscode.commands.registerCommand("codecoach.openChat", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.codecoach");
      provider?.reveal();
    })
  );

  // Initial status
  provider.postStatus(isDemoMode() ? "Demo mode: Pick an assignment → Chat → Export." : "Tip: Set API URLs → Connect → Open assignment.");
}

export function deactivate() {}