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
  const raw =
    cfg.get<string>("codecoach.webBaseUrl") ||
    "https://codecoach-anastasiakazanas-projects.vercel.app";
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

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${supabaseJwt}`,
      },
    });

    // Some failures return HTML or empty bodies; don't assume JSON.
    const contentType = res.headers.get("content-type") || "";
    let payload: any = null;

    if (contentType.includes("application/json")) {
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }
    } else {
      const text = await res.text().catch(() => "");
      payload = text ? { error: text } : null;
    }

    if (!res.ok) {
      const message =
        payload && typeof payload === "object" && "error" in payload
          ? String((payload as any).error)
          : `Bootstrap failed (${res.status} ${res.statusText}).`;

      throw new Error(`${message}\nURL: ${url}`);
    }

    return payload as any;
  } catch (err: any) {
    // Node/undici network errors often surface as `TypeError: fetch failed`.
    const msg = err?.message ?? String(err);
    throw new Error(`Network error while calling bootstrap.\n${msg}\nURL: ${url}`);
  }
}

async function callGemini(apiKey: string, prompt: string) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent` +
    `?key=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3 },
      }),
    });

    const contentType = res.headers.get("content-type") || "";
    let data: any = null;

    if (contentType.includes("application/json")) {
      try {
        data = await res.json();
      } catch {
        data = null;
      }
    } else {
      const text = await res.text().catch(() => "");
      data = text ? { error: { message: text } } : null;
    }

    if (!res.ok) {
      const apiMsg = data?.error?.message;
      throw new Error(
        `${apiMsg ?? `Gemini request failed (${res.status} ${res.statusText}).`}\nURL: ${url}`
      );
    }

    return (
      data?.candidates?.[0]?.content?.parts
        ?.map((p: any) => p?.text)
        .join("") ?? "No response."
    );
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    throw new Error(`Network error while calling Gemini.\n${msg}`);
  }
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
You are CodeCoach. Guide learning. Do NOT give full homework solutions.

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
          vscode.window.showErrorMessage(e?.message ?? "Failed to connect.");
        }
      },
    })
  );
}

export function deactivate() {}