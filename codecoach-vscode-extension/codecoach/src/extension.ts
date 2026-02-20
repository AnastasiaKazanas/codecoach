import * as vscode from "vscode";
import { CodeCoachViewProvider } from "./codecoachView";
import { MOCK_ASSIGNMENTS, Assignment as MockAssignment } from "./mockData";

let lastAssignmentId: string | null = null;
let lastCourseId: string | null = null;

const GEMINI_KEY_NAME = "codecoach.geminiKey";
const AUTH_TOKEN_KEY = "codecoach.authToken"; // optional for later

// In-memory chat history (session-only)
type ChatMsg = { role: "user" | "model"; text: string };
const chatHistory: ChatMsg[] = [];
const MAX_TURNS = 12;

type Assignment = {
  id: string;
  title: string;
  courseId: string;
  fundamentals: string[];
  objectives: string[];
  instructions: string;
};

// Persistent learning profile (overall, across sessions)
const PROFILE_KEY = "codecoach.learningProfile.v1";

const httpFetch: typeof fetch = (globalThis as any).fetch;
if (!httpFetch) {
  throw new Error("fetch() is not available in this VS Code runtime. Update VS Code or add a fetch polyfill.");
}

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
  const topics = uniq([...(oldP.topics || []), ...(newP.topics || [] )]);

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

// ----------------------------
// Gemini helper
// ----------------------------
async function callGeminiGenerateContent(apiKey: string, prompt: string) {
  const modelName = "models/gemini-flash-latest";
  const url =
    `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent` +
    `?key=${encodeURIComponent(apiKey)}`;

  const res = await httpFetch(url, {
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

// ----------------------------
// Real-mode assignment fetch
// ----------------------------
type AssignmentApiResponse =
  | { assignment: any }
  | { error: string };

async function fetchAssignmentFromWeb(assignmentId: string): Promise<any> {
  const cfg = vscode.workspace.getConfiguration();
  const baseUrlRaw = cfg.get<string>("codecoach.webBaseUrl") || "http://localhost:3000";
  const baseUrl = normalizeBaseUrl(baseUrlRaw);

  const url = `${baseUrl}/api/assignments/${encodeURIComponent(assignmentId)}`;
  const res = await httpFetch(url);

  const json = (await res.json()) as AssignmentApiResponse;

  if (!res.ok) {
    if ("error" in json) throw new Error(json.error);
    throw new Error(`Failed to fetch assignment (${res.status})`);
  }

  if (!("assignment" in json)) {
    throw new Error("API did not return assignment.");
  }

  return json.assignment;
}

// Normalize whatever your API returns into what the chat expects
type LiveAssignment = {
  id: string;
  courseId: string;
  title: string;
  instructions: string;
  fundamentals: string[];
  objectives: string[];
};

function normalizeAssignmentFromApi(raw: any): LiveAssignment {
  // Accept either snake_case or camelCase from your API
  const id = String(raw?.id ?? "");
  const courseId = String(raw?.course_id ?? raw?.courseId ?? "");
  const title = String(raw?.title ?? "");

  // Instructions: you might store HTML in instructions_html
  const instructions =
    String(raw?.instructions ?? "") ||
    String(raw?.instructions_html ?? raw?.instructionsHtml ?? "");

  // fundamentals/objectives: might be array already OR stored as json/text
  const fundamentalsRaw = raw?.fundamentals ?? [];
  const objectivesRaw = raw?.objectives ?? [];

  const fundamentals = Array.isArray(fundamentalsRaw)
    ? fundamentalsRaw.map((x: any) => String(x))
    : typeof fundamentalsRaw === "string"
      ? fundamentalsRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

  const objectives = Array.isArray(objectivesRaw)
    ? objectivesRaw.map((x: any) => String(x))
    : typeof objectivesRaw === "string"
      ? objectivesRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

  if (!id) throw new Error("Assignment missing id");
  if (!courseId) throw new Error("Assignment missing courseId/course_id");
  if (!title) throw new Error("Assignment missing title");

  return { id, courseId, title, instructions, fundamentals, objectives };
}

// Trace + active session
type TraceEvent = {
  type: "chat_user" | "chat_model" | "checkpoint";
  ts: string;
  payload: any;
};

type AnyAssignment = MockAssignment | LiveAssignment;

type ActiveSession = {
  assignmentId: string;
  sessionId: string;
  assignment: Assignment;
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
  // ✅ ONE URI handler
  // vscode://<publisher>.<name>/open?assignmentId=...&courseId=...
  // ----------------------------
  context.subscriptions.push(
    vscode.window.registerUriHandler({
      handleUri(uri) {
        const params = new URLSearchParams(uri.query);
        const assignmentId = params.get("assignmentId");
        const courseId = params.get("courseId");

        if (!assignmentId) {
          vscode.window.showErrorMessage("CodeCoach link missing assignmentId.");
          return;
        }

        lastAssignmentId = assignmentId;
        lastCourseId = courseId; // may be null

        vscode.window.showInformationMessage(`CodeCoach linked to assignment ${assignmentId}`);

        // Only auto-connect if courseId is present (or you fetch it in connect)
        vscode.commands.executeCommand("codecoach.connect");
      }
    })
  );

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

  // Optional token command (not required for MVP)
  context.subscriptions.push(
    vscode.commands.registerCommand("codecoach.connectAccount", async () => {
      const token = await vscode.window.showInputBox({
        prompt: "Paste your CodeCoach token (optional for now)",
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
  // Open chat view
  // ----------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand("codecoach.openChat", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.codecoach");
      provider?.reveal();
    })
  );

  // ----------------------------
  // ✅ Connect (used by URI deep link)
  // - demo mode: uses mock assignments
  // - real mode: fetches from web API using codecoach.webBaseUrl
  // ----------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand("codecoach.connect", async () => {
      try {
        await vscode.commands.executeCommand("codecoach.openChat");

        if (!lastAssignmentId) {
          // If no deep link ID, fall back to openAssignment flow
          await vscode.commands.executeCommand("codecoach.openAssignment");
          return;
        }

        if (isDemoMode()) {
          const assignment = MOCK_ASSIGNMENTS.find((a) => a.id === lastAssignmentId);
          if (!assignment) {
            vscode.window.showErrorMessage(
              `Unknown assignmentId "${lastAssignmentId}". (Demo mode only knows IDs in mockData.ts)`
            );
            return;
          }

          activeSession = {
            assignmentId: assignment.id,
            sessionId: `demo-${Date.now()}`,
            assignment,
            traceBuffer: [],
            submitted: false
          };

          provider?.postStatus(`Active assignment: ${assignment.title}`);
          return;
        }

        console.log("CONNECT lastAssignmentId:", lastAssignmentId);
        
        // Real mode
        const raw = await fetchAssignmentFromWeb(lastAssignmentId);
        const assignment = normalizeAssignmentFromApi(raw);
        
        lastCourseId =
          (assignment as any).courseId ??
          (assignment as any).course_id ??
          lastCourseId;

        if (!lastCourseId) {
          throw new Error("Missing courseId. Make sure your web API returns courseId/course_id for the assignment.");
        }

        activeSession = {
          assignmentId: assignment.id,
          sessionId: `live-${Date.now()}`,
          assignment,
          traceBuffer: [],
          submitted: false
        };

        console.log("lastAssignmentId", lastAssignmentId);
        console.log("raw assignment", raw);
        console.log("normalized assignment", assignment);
        console.log("derived courseId", lastCourseId);

        provider?.postStatus(`Active assignment: ${assignment.title}`);
        vscode.window.showInformationMessage(`CodeCoach: loaded "${assignment.title}".`);
      } catch (e: any) {
        vscode.window.showErrorMessage(e?.message ?? "Failed to connect.");
      }

    })
  );

  // ----------------------------
  // Clear chat (session)
  // ----------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand("codecoach.clearChat", async () => {
      chatHistory.length = 0;
      vscode.window.showInformationMessage("CodeCoach: chat cleared for this session.");
      provider?.postStatus(activeSession ? `Active assignment: ${activeSession.assignment.title}` : "Chat cleared.");
    })
  );

  // ----------------------------
  // Open assignment
  // - demo mode: pick from mockData.ts
  // - real mode: ask for assignmentId (temporary until web deep-link is primary)
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

        activeSession = {
          assignmentId: assignment.id,
          sessionId: `demo-${Date.now()}`,
          assignment,
          traceBuffer: [],
          submitted: false
        };

        lastAssignmentId = assignment.id;
        lastCourseId = assignment.courseId;

        provider?.postStatus(`Active assignment: ${assignment.title}`);
        vscode.window.showInformationMessage(`CodeCoach (demo): opened "${assignment.title}".`);
        await vscode.commands.executeCommand("codecoach.openChat");
        return;
      }

      // Real mode fallback: ask for assignmentId (until web integration is fully wired)
      const id = await vscode.window.showInputBox({
        prompt: "Enter Assignment ID",
        ignoreFocusOut: true
      });
      if (!id) return;

      lastAssignmentId = id.trim();
      await vscode.commands.executeCommand("codecoach.connect");
    })
  );

  // ----------------------------
  // Export learning summary (same logic you had)
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

## Session Summary
**Topics**
${(session.topicsDiscussed || []).map((x: string) => `- ${x}`).join("\n") || "- (none)"}

**Mastered**
${(session.fundamentalsMastered || []).map((x: string) => `- ${x}`).join("\n") || "- (none)"}

**Developing**
${(session.fundamentalsDeveloping || []).map((x: string) => `- ${x}`).join("\n") || "- (none)"}

**Highlights**
${(session.highlights || []).map((x: string) => `- ${x}`).join("\n") || "- (none)"}

---

## Overall (to date)
_Last updated: ${learningProfile.updatedAtISO}_

**Topics**
${(learningProfile.topics || []).map((x) => `- ${x}`).join("\n") || "- (none)"}

**Mastered**
${(learningProfile.mastered || []).map((x) => `- ${x}`).join("\n") || "- (none)"}

**Developing**
${(learningProfile.developing || []).map((x) => `- ${x}`).join("\n") || "- (none)"}

**Notes**
${learningProfile.notes?.trim() ? learningProfile.notes : "(none)"}
`;

      await vscode.env.clipboard.writeText(md);
      const doc = await vscode.workspace.openTextDocument({ content: md, language: "markdown" });
      await vscode.window.showTextDocument(doc, { preview: false });

      vscode.window.showInformationMessage("Learning summary exported (opened + copied).");
    })
  );

  // ----------------------------
  // Submit learning process (demo-ish)
  // ----------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand("codecoach.submitLearningProcess", async () => {
      if (!activeSession) {
        vscode.window.showErrorMessage('No active assignment. Run "CodeCoach: Open Assignment" first.');
        return;
      }

      await vscode.commands.executeCommand("codecoach.exportLearningSummary");
      activeSession.submitted = true;

      vscode.window.showInformationMessage(`Submitted: ${activeSession.assignment.title}`);
      provider?.postStatus(`Submitted: ${activeSession.assignment.title}`);
    })
  );

  // ----------------------------
  // Chat handler
  // ----------------------------
  const onUserMessage = async (userText: string, contextText: string): Promise<string> => {
    const apiKey = await context.secrets.get(GEMINI_KEY_NAME);
    if (!apiKey) throw new Error('No Gemini API key set. Run "CodeCoach: Set Gemini API Key".');

    chatHistory.push({ role: "user", text: userText });

    if (activeSession) {
      activeSession.traceBuffer.push({
        type: "chat_user",
        ts: new Date().toISOString(),
        payload: { text: userText }
      });
    }

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

    const instructions = `
You are CodeCoach. Prioritize learning and hints over solutions.
- Ask ONE guiding question per message by default.
- Don’t write full solution code for the student’s homework.
- Use small toy snippets only when needed.
`.trim();

    const prompt = `
${instructions}

${assignmentContext}

Conversation so far:
${historyText || "(none)"}

Relevant code context:
${safeContext || "(none)"}

User:
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
  // Webview provider
  // ----------------------------
  provider = new CodeCoachViewProvider(context, onUserMessage);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("codecoach.chatView", provider)
  );

  provider.postStatus(
    isDemoMode()
      ? "Demo mode: pick an assignment → Chat → Export."
      : "Real mode: open from web link (vscode://...)"
  );
}

export function deactivate() {}