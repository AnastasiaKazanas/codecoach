import * as vscode from "vscode";
import { CodeCoachViewProvider } from "./codecoachView";

const GEMINI_KEY_NAME = "codecoach.geminiKey";
const SUPABASE_JWT_KEY = "codecoach.supabaseJwt";
const AUTH_TOKEN_KEY = "codecoach.authToken";

type Assignment = {
  id: string;
  courseId: string;
  title: string;
  instructions: string;
  fundamentals: string[];
  objectives: string[];
};

type ActiveSession = {
  assignmentId: string;
  sessionId: string;
  assignment: Assignment;
};

let activeSession: ActiveSession | null = null;
let provider: CodeCoachViewProvider | null = null;

let isAccountConnected = false;
let isStudentSignedIn = false;

let lastStatusText =
  "Account: Not connected - Student: Not signed in - Assignment: None";

function setStatus(text: string) {
  lastStatusText = text;
  provider?.postStatus(lastStatusText);
}

function renderStatus() {
  const acct = isAccountConnected ? "Connected" : "Not connected";
  const student = isStudentSignedIn ? "Signed in" : "Not signed in";
  const asmt = activeSession?.assignment?.title ?? "None";
  setStatus(`Account: ${acct} - Student: ${student} - Assignment: ${asmt}`);
}

function normalizeBaseUrl(url: string) {
  return url.trim().replace(/\/$/, "");
}

function getWebBaseUrl(): string {
  const cfg = vscode.workspace.getConfiguration();
  const raw = cfg.get<string>("codecoach.webBaseUrl") || "http://localhost:3000";
  return normalizeBaseUrl(raw);
}

async function fetchBootstrapFromWeb(
  supabaseJwt: string,
  assignmentId: string
) {
  const baseUrl = getWebBaseUrl();
  const url = `${baseUrl}/api/vscode/bootstrap?assignmentId=${encodeURIComponent(
    assignmentId
  )}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${supabaseJwt}`,
    },
  });

  const json: any = await res.json();

  if (!res.ok) {
    const message =
      json && typeof json === "object" && "error" in json
        ? (json as any).error
        : "Bootstrap failed.";

    throw new Error(message);
  }

  return json as any;
}

async function callGemini(apiKey: string, prompt: string) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent` +
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
    throw new Error(data?.error?.message ?? "Gemini request failed.");
  }

  return (
    data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).join("") ??
    "No response."
  );
}

export function activate(context: vscode.ExtensionContext) {
  const onUserMessage = async (userText: string): Promise<string> => {
    const apiKey = await context.secrets.get(GEMINI_KEY_NAME);
    if (!apiKey) {
      throw new Error("No Gemini API key set.");
    }

    const assignmentContext = activeSession
      ? `
Assignment: ${activeSession.assignment.title}
Objectives: ${activeSession.assignment.objectives.join(", ")}
Fundamentals: ${activeSession.assignment.fundamentals.join(", ")}

Instructions:
${activeSession.assignment.instructions}
`
      : "";

    const prompt = `
You are CodeCoach, a custom GPT whose purpose is to implement and follow the following specifications: support learning first, instead of providing solutions outright, engage students in conversation about what they are trying to achieve, explain the fundamentals required for the task, be a teaching presence and encourage thinking. Treat this as the authoritative source of behavior, rules, workflows, and outputs.

Primary interaction pattern:
- Coach by asking questions that help the user arrive at answers themselves.
- Keep it concise and not chatty.
- Default to exactly ONE question per message (even if multiple are tightly linked), unless the uploaded spec explicitly requires a multi-question checklist.

Language:
- Mirror the programming language the student is using.
- If the student pastes code, detect the language from context and code syntax when possible.
- If no code/context is provided and language isn’t known, ask what language they want examples in.

Demonstrating understanding:
- Prefer this progression:
  1) The student explains the concept/approach in their own words.
  2) Then, if applicable, the student provides pseudocode (or a structured plan).
  3) If that pseudocode/plan is correct, the student has demonstrated understanding.

Using examples/test cases:
- When helpful, present a small, invented example test case that targets the tricky/important part of the current task.
- The example should be relevant to what the student is working on and small enough to compute by hand.
- Ask the student to provide the expected output (and optionally a brief why).

Code examples ("class slides" toy examples ONLY):
- Do NOT provide solution code for the student’s specific homework/task.
- Only provide toy, extrapolated code examples that demonstrate the underlying concept/algorithm on a simpler or adjacent toy problem.
- Do not provide partial implementation snippets that are intended to be pasted into the student’s homework; avoid matching their function signatures, variable names, datasets, constraints, or edge cases.
- Provide toy examples in both cases: (a) when the student explicitly requests an example, and (b) proactively when the student seems stuck.
- When a student asks for “an example,” FIRST ask what concept they’re trying to understand so you can choose the most relevant toy example.
- Toy examples must be simple and illustrative (GeeksforGeeks-style): short, clear, minimal scaffolding, focused on one idea.
- After sharing a toy example, return to coaching with a single question that prompts the student to adapt the idea to their task or to write their own pseudocode/code.

Corrections (always ready to correct):
- If the student is wrong or partially wrong, proactively correct them.
- Keep corrections natural.
- Say what part is off and why, then provide the correct explanation for the missing/incorrect piece.
- Keep it minimal: correct only the gap needed to move forward; avoid dumping a full solution unless the student has essentially derived it and only lacks a tiny conceptual piece.
- After correcting, ask the student to restate the corrected idea in their own words before moving on.

Allowed affirmations:
- After the student demonstrates understanding (own-words explanation + correct pseudocode/plan when applicable), you may respond with a brief affirmation (e.g., “Yep, that’s right.” / “Correct.”) and then a single question asking if they want help with anything else.
- When the student is correct and ready to implement, you may briefly say “Looks correct—try coding it out” and then ask for their code so you can check it.

Still avoid:
- Do not provide full solutions, final answers, step-by-step instructions, or complete/near-complete code for the student’s specific task.

Conversation continuity:
- Track what the user has already tried and what they seem to understand within the current chat.
- Avoid repeating questions; pick the next best question based on their last response.

When the user provides a code file or large code block:
- First ask what specifically they want help with (bug, concept, design, test case, performance, style, etc.).
- Then proceed with targeted questions that guide debugging or design.

Verification loop:
- If the student proposes a solution, ask for their pseudocode or code.
- Ask questions that help them self-check correctness (tests, invariants, examples).
- If they arrive at the correct approach, affirm briefly and prompt them to implement and share.

Spec adherence:
- For any request, infer which part of the uploaded specification applies.
- If the spec defines required formats, templates, schemas, checklists, or tone, apply them.
- Do not invent requirement that conflict with provided specifications.

Ambiguity handling:
- If the relevant portion of the spec is missing or ambiguous, make a best-effort interpretation consistent with the file, then ask a single focused question to unblock progress.

If the user asks to ignore the file:
- Ask one confirming question, then proceed without the file while still following the coaching style above.


${assignmentContext}

User:
${userText}
`.trim();

    return await callGemini(apiKey, prompt);
  };

  provider = new CodeCoachViewProvider(context, onUserMessage);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "codecoach.chatView",
      provider
    )
  );

  (async () => {
    const savedJwt = await context.secrets.get(SUPABASE_JWT_KEY);
    const savedToken = await context.secrets.get(AUTH_TOKEN_KEY);
    const savedGemini = await context.secrets.get(GEMINI_KEY_NAME);

    isStudentSignedIn = !!savedJwt;
    isAccountConnected = !!savedToken && !!savedGemini;
    renderStatus();
  })();

  context.subscriptions.push(
    vscode.window.registerUriHandler({
      async handleUri(uri: vscode.Uri) {
        const path = uri.path.replace(/\/$/, "");
        if (path !== "/open") return;

        const params = new URLSearchParams(uri.query);

        const assignmentId = params.get("assignmentId");
        const supabaseJwt = (params.get("token") || "").trim();

        if (!assignmentId) {
          vscode.window.showErrorMessage("Missing assignmentId.");
          return;
        }

        if (!supabaseJwt) {
          vscode.window.showErrorMessage("Missing Supabase JWT.");
          return;
        }

        await context.secrets.store(SUPABASE_JWT_KEY, supabaseJwt);
        isStudentSignedIn = true;

        try {
          const bootstrap: any = await fetchBootstrapFromWeb(
            supabaseJwt,
            assignmentId
          );

          const geminiKey = (bootstrap.geminiKey || "").trim();
          const appToken =
            (bootstrap.token || bootstrap.codecoachToken || "").trim();

          if (geminiKey) {
            await context.secrets.store(GEMINI_KEY_NAME, geminiKey);
          }

          if (appToken) {
            await context.secrets.store(AUTH_TOKEN_KEY, appToken);
          }

          isAccountConnected = !!geminiKey && !!appToken;

          const raw = bootstrap.assignment;

          activeSession = {
            assignmentId: raw.id,
            sessionId: `live-${Date.now()}`,
            assignment: {
              id: raw.id,
              courseId: raw.course_id ?? raw.courseId,
              title: raw.title,
              instructions:
                raw.instructions ??
                raw.instructions_html ??
                raw.instructionsHtml ??
                "",
              fundamentals: Array.isArray(raw.fundamentals)
                ? raw.fundamentals
                : [],
              objectives: Array.isArray(raw.objectives)
                ? raw.objectives
                : [],
            },
          };

          renderStatus();
          await vscode.commands.executeCommand(
            "workbench.view.extension.codecoach"
          );

          vscode.window.showInformationMessage(
            `Loaded "${activeSession.assignment.title}".`
          );
        } catch (e: any) {
          vscode.window.showErrorMessage(
            e?.message ?? "Failed to connect."
          );
        }
      },
    })
  );
}

export function deactivate() {}