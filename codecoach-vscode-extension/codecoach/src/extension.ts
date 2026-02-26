import * as vscode from "vscode";
import { CodeCoachViewProvider } from "./codecoachView";
import dns from "node:dns";

const GEMINI_KEY_NAME = "codecoach.geminiKey";
const SUPABASE_JWT_KEY = "codecoach.supabaseJwt";
const AUTH_TOKEN_KEY = "codecoach.authToken";

const PENDING_STARTER_KEY = "codecoach.pendingStarter";
const STARTER_ZIP_MAX_BYTES = 50 * 1024 * 1024; // 50MB safety cap

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

let output: vscode.OutputChannel | null = null;

function log(msg: string) {
  const line = `[CodeCoach] ${msg}`;
  output?.appendLine(line);
  // Also mirrors into the Extension Host console.
  console.log(line);
}

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

function firstWorkspaceFolderUri(): vscode.Uri | null {
  return vscode.workspace.workspaceFolders?.[0]?.uri ?? null;
}

async function promptForWorkspaceFolder(): Promise<vscode.Uri | null> {
  const picked = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: "Open assignment folder",
    title: "Choose a folder to place the starter files",
  });
  return picked?.[0] ?? null;
}

async function openFolderAndReload(folder: vscode.Uri): Promise<void> {
  // This reloads the window.
  await vscode.commands.executeCommand("vscode.openFolder", folder, false);
}

async function downloadToBuffer(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Starter zip download failed (${res.status} ${res.statusText}).${text ? `\n${text}` : ""}\nURL: ${url}`
    );
  }

  const lenHeader = res.headers.get("content-length");
  if (lenHeader) {
    const len = Number(lenHeader);
    if (!Number.isNaN(len) && len > STARTER_ZIP_MAX_BYTES) {
      throw new Error(
        `Starter zip too large (${Math.round(len / 1024 / 1024)}MB). Limit is ${Math.round(
          STARTER_ZIP_MAX_BYTES / 1024 / 1024
        )}MB.`
      );
    }
  }

  const ab = await res.arrayBuffer();
  if (ab.byteLength > STARTER_ZIP_MAX_BYTES) {
    throw new Error(
      `Starter zip too large (${Math.round(ab.byteLength / 1024 / 1024)}MB). Limit is ${Math.round(
        STARTER_ZIP_MAX_BYTES / 1024 / 1024
      )}MB.`
    );
  }
  return new Uint8Array(ab);
}

function safeZipEntryPath(entryName: string): string {
  // Prevent zip-slip. Normalize to forward slashes, strip leading slashes.
  const cleaned = entryName.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = cleaned.split("/").filter(Boolean);
  const safeParts: string[] = [];
  for (const p of parts) {
    if (p === "." || p === "..") continue;
    safeParts.push(p);
  }
  return safeParts.join("/");
}

async function extractZipToWorkspace(zipBytes: Uint8Array, destFolder: vscode.Uri): Promise<string[]> {
  // Uses optional dependency adm-zip.
  let AdmZip: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    AdmZip = require("adm-zip");
  } catch {
    throw new Error(
      "Missing dependency 'adm-zip'. Run: npm i adm-zip (in the extension project), then rebuild/reload."
    );
  }

  const zip = new AdmZip(Buffer.from(zipBytes));
  const entries: any[] = zip.getEntries();
  const written: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const rel = safeZipEntryPath(String(entry.entryName || ""));
    if (!rel) continue;

    const outUri = vscode.Uri.joinPath(destFolder, rel);
    const parent = vscode.Uri.joinPath(outUri, "..");
    await vscode.workspace.fs.createDirectory(parent);
    await vscode.workspace.fs.writeFile(outUri, entry.getData());
    written.push(rel);
  }

  return written;
}

async function openSuggestedFiles(destFolder: vscode.Uri, suggested: string[], written: string[]) {
  const toOpen = (Array.isArray(suggested) ? suggested : []).filter(Boolean);

  // If instructor didn't specify, try README.* then first few files.
  const fallback: string[] = [];
  const readmes = written.filter((p) => /^readme(\.|$)/i.test(p.split("/").pop() || ""));
  if (readmes.length) fallback.push(readmes[0]);
  for (const p of written) {
    if (fallback.length >= 3) break;
    if (fallback.includes(p)) continue;
    fallback.push(p);
  }

  const finalList = (toOpen.length ? toOpen : fallback).slice(0, 5);
  for (const rel of finalList) {
    try {
      const fileUri = vscode.Uri.joinPath(destFolder, rel);
      const doc = await vscode.workspace.openTextDocument(fileUri);
      await vscode.window.showTextDocument(doc, { preview: false });
    } catch {
      // ignore missing/binary
    }
  }
}

type PendingStarter = {
  zipUrl: string;
  suggestedOpen?: string[];
};

async function maybeInstallStarterFromBootstrap(
  context: vscode.ExtensionContext,
  starter: any
): Promise<void> {
  const zipUrl = (starter?.zipUrl || starter?.starterZipUrl || "").trim();
  const suggestedOpen = Array.isArray(starter?.open)
    ? starter.open
    : Array.isArray(starter?.suggestedOpen)
      ? starter.suggestedOpen
      : Array.isArray(starter?.openFiles)
        ? starter.openFiles
        : [];

  if (!zipUrl) return;

  // Ensure a workspace folder exists; if not, pick one and reopen.
  const existing = firstWorkspaceFolderUri();
  if (!existing) {
    const folder = await promptForWorkspaceFolder();
    if (!folder) {
      throw new Error("No folder selected. Open a folder in VS Code to install starter files.");
    }

    const pending: PendingStarter = { zipUrl, suggestedOpen };
    await context.globalState.update(PENDING_STARTER_KEY, pending);
    await openFolderAndReload(folder);
    return; // window reloads
  }

  log(`Downloading starter zip: ${zipUrl}`);
  const zipBytes = await downloadToBuffer(zipUrl);

  log(`Extracting starter zip into: ${existing.fsPath}`);
  const written = await extractZipToWorkspace(zipBytes, existing);
  log(`Starter files written: ${written.length}`);

  await openSuggestedFiles(existing, suggestedOpen, written);
}

async function maybeInstallPendingStarter(context: vscode.ExtensionContext) {
  const pending = context.globalState.get<PendingStarter>(PENDING_STARTER_KEY);
  if (!pending?.zipUrl) return;

  const existing = firstWorkspaceFolderUri();
  if (!existing) return;

  try {
    log(`Resuming pending starter install...`);
    const zipBytes = await downloadToBuffer(pending.zipUrl);
    const written = await extractZipToWorkspace(zipBytes, existing);
    log(`Starter files written: ${written.length}`);
    await openSuggestedFiles(existing, pending.suggestedOpen ?? [], written);
  } finally {
    await context.globalState.update(PENDING_STARTER_KEY, undefined);
  }
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
  output = vscode.window.createOutputChannel("CodeCoach");
  context.subscriptions.push(output);
  log("activate()");
  log(`webBaseUrl=${getWebBaseUrl()}`);
  // Workaround: on some networks Node may resolve Vercel to IPv6 first and fail to connect.
  // Prefer IPv4 to avoid `TypeError: fetch failed`.
  try {
    // @ts-ignore - available in Node 16+
    dns.setDefaultResultOrder?.("ipv4first");
    log("dns.setDefaultResultOrder(ipv4first) applied");
  } catch (e: any) {
    log(`dns.setDefaultResultOrder not applied: ${e?.message ?? String(e)}`);
  }

  void maybeInstallPendingStarter(context);

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
    log(
      `startup status: studentSignedIn=${isStudentSignedIn} accountConnected=${isAccountConnected}`
    );
  })();

  context.subscriptions.push(
    vscode.window.registerUriHandler({
      async handleUri(uri: vscode.Uri) {
        const path = uri.path.replace(/\/$/, "");
        log(`handleUri path=${path} uri=${uri.toString()}`);
        if (path !== "/open") return;

        const params = new URLSearchParams(uri.query);

        const assignmentId = params.get("assignmentId");
        const supabaseJwt = (params.get("token") || "").trim();

        log(
          `handleUri params: assignmentId=${assignmentId ?? ""} tokenPresent=${!!supabaseJwt}`
        );

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
          log(`fetchBootstrapFromWeb -> ${getWebBaseUrl()}/api/vscode/bootstrap`);
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

          // Option A: if instructor uploaded a starter zip, bootstrap can include a signed URL.
          // For now we try:
          //  - bootstrap.starter (preferred)
          //  - bootstrap.starterFiles (alt)
          //  - assignment.starter_bundle (if backend embeds signed URL there)
          const starter =
            bootstrap.starter ||
            bootstrap.starterFiles ||
            bootstrap.assignment?.starter_bundle ||
            bootstrap.assignment?.starterBundle ||
            null;

          try {
            await maybeInstallStarterFromBootstrap(context, starter);
          } catch (starterErr: any) {
            log(`starter install skipped/failed: ${starterErr?.message ?? String(starterErr)}`);
          }

          renderStatus();
          await vscode.commands.executeCommand(
            "workbench.view.extension.codecoach"
          );

          vscode.window.showInformationMessage(
            `Loaded "${activeSession.assignment.title}".`
          );
        } catch (e: any) {
          log(`connect failed: ${e?.message ?? String(e)}`);
          vscode.window.showErrorMessage(e?.message ?? "Failed to connect.");
        }
      },
    })
  );
}

export function deactivate() {}