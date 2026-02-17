"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode2 = __toESM(require("vscode"));

// src/codecoachView.ts
var vscode = __toESM(require("vscode"));
console.log("\u2705 codecoachView.ts module loaded");
var CodeCoachViewProvider = class {
  constructor(context, onUserMessage) {
    this.context = context;
    this.onUserMessage = onUserMessage;
  }
  static viewType = "codecoach.chatView";
  _view;
  resolveWebviewView(webviewView) {
    console.log("\u2705 resolveWebviewView called");
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true
    };
    webviewView.webview.html = this.getHtml();
    webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type !== "send") return;
      try {
        const editor = vscode.window.activeTextEditor;
        const contextText = editor?.document.getText() ?? "";
        const reply = await this.onUserMessage(msg.text, contextText);
        webviewView.webview.postMessage({
          type: "assistant",
          text: reply
        });
      } catch (err) {
        webviewView.webview.postMessage({
          type: "assistant",
          text: `Error: ${err?.message ?? String(err)}`
        });
      } finally {
        webviewView.webview.postMessage({
          type: "done"
        });
      }
    });
  }
  reveal() {
    this._view?.show?.(true);
  }
  getHtml() {
    return (
      /* html */
      `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  :root {
    --bg: var(--vscode-sideBar-background);
    --fg: var(--vscode-foreground);
    --muted: var(--vscode-descriptionForeground);
    --border: var(--vscode-sideBar-border);
    --inputBg: var(--vscode-input-background);
    --inputFg: var(--vscode-input-foreground);
    --btnBg: var(--vscode-button-background);
    --btnFg: var(--vscode-button-foreground);
    --btnHover: var(--vscode-button-hoverBackground);

    --bubbleUser: rgba(0, 122, 255, 0.18);
    --bubbleAsst: rgba(120, 120, 120, 0.18);
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    margin: 0;
    padding: 0;
    color: var(--fg);
    background: var(--bg);
  }

  .wrap {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  #chat {
    flex: 1;
    overflow-y: auto;
    padding: 10px 10px 0 10px;
  }

  .row {
    display: flex;
    margin: 8px 0;
  }

  .row.user { justify-content: flex-end; }
  .row.assistant { justify-content: flex-start; }

  .bubble {
    max-width: 85%;
    padding: 10px 12px;
    border-radius: 14px;
    white-space: pre-wrap;
    word-wrap: break-word;
    line-height: 1.35;
    border: 1px solid rgba(255,255,255,0.06);
  }

  .bubble.user {
    background: var(--bubbleUser);
  }

  .bubble.assistant {
    background: var(--bubbleAsst);
  }

  .label {
    font-size: 11px;
    color: var(--muted);
    margin: 0 10px 4px 10px;
  }

  .composer {
    border-top: 1px solid rgba(255,255,255,0.08);
    padding: 10px;
    display: flex;
    gap: 8px;
    align-items: flex-end;
    background: var(--bg);
  }

  textarea {
    width: 100%;
    resize: none;
    min-height: 36px;
    max-height: 140px;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.10);
    background: var(--inputBg);
    color: var(--inputFg);
    outline: none;
    font-family: inherit;
    font-size: 13px;
    line-height: 1.35;
  }

  button {
    border: none;
    border-radius: 10px;
    padding: 9px 12px;
    background: var(--btnBg);
    color: var(--btnFg);
    cursor: pointer;
    font-weight: 600;
    font-size: 12px;
  }

  button:hover { background: var(--btnHover); }
  button:disabled { opacity: 0.6; cursor: default; }

  .thinking {
    font-size: 12px;
    color: var(--muted);
    margin: 6px 10px 10px 10px;
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="label">CodeCoach Chat</div>
  <div id="chat" aria-label="Chat history"></div>
  <div id="thinking" class="thinking" style="display:none;">Thinking\u2026</div>

  <div class="composer">
    <textarea id="input" placeholder="Ask CodeCoach\u2026 (Enter to send, Shift+Enter for newline)"></textarea>
    <button id="sendBtn" title="Send">Send</button>
  </div>
</div>

<script>
  const vscode = acquireVsCodeApi();

  const chat = document.getElementById("chat");
  const input = document.getElementById("input");
  const sendBtn = document.getElementById("sendBtn");
  const thinking = document.getElementById("thinking");

  function scrollToBottom() {
    chat.scrollTop = chat.scrollHeight;
  }

  function addMessage(role, text) {
    const row = document.createElement("div");
    row.className = "row " + role;

    const bubble = document.createElement("div");
    bubble.className = "bubble " + role;

    // IMPORTANT: textContent prevents HTML injection (no innerHTML)
    bubble.textContent = text;

    row.appendChild(bubble);
    chat.appendChild(row);

    scrollToBottom();
  }

  function setBusy(isBusy) {
    input.disabled = isBusy;
    sendBtn.disabled = isBusy;
    thinking.style.display = isBusy ? "block" : "none";
  }

  function sendCurrent() {
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    addMessage("user", text);
    setBusy(true);

    vscode.postMessage({ type: "send", text });
  }

  // Enter sends, Shift+Enter newline
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendCurrent();
    }
  });

  sendBtn.addEventListener("click", () => {
    sendCurrent();
  });

  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg || !msg.type) return;

    if (msg.type === "assistant") {
      addMessage("assistant", msg.text || "");
    }

    if (msg.type === "done") {
      setBusy(false);
      input.focus();
    }
  });

  // Start focused
  input.focus();
</script>
</body>
</html>`
    );
  }
};

// src/extension.ts
var KEY_NAME = "codecoach.geminiKey";
var chatHistory = [];
var MAX_TURNS = 12;
var PROFILE_KEY = "codecoach.learningProfile.v1";
function uniq(arr) {
  return Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)));
}
function mergeProfiles(oldP, newP) {
  const mastered = uniq([...oldP.mastered || [], ...newP.mastered || []]);
  const developingRaw = uniq([...oldP.developing || [], ...newP.developing || []]);
  const developing = developingRaw.filter((x) => !mastered.includes(x));
  const topics = uniq([...oldP.topics || [], ...newP.topics || []]);
  return {
    updatedAtISO: (/* @__PURE__ */ new Date()).toISOString(),
    mastered,
    developing,
    topics,
    notes: newP.notes || oldP.notes
  };
}
async function callGeminiGenerateContent(apiKey, prompt) {
  const modelName = "models/gemini-flash-latest";
  const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3 }
    })
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message ?? JSON.stringify(data);
    throw new Error(`${res.status} ${msg}`);
  }
  return data?.candidates?.[0]?.content?.parts?.map((p) => p?.text).join("") ?? "No response.";
}
function activate(context) {
  console.log("\u2705 CodeCoach activate() ran");
  let learningProfile = context.globalState.get(PROFILE_KEY) || {
    updatedAtISO: (/* @__PURE__ */ new Date()).toISOString(),
    mastered: [],
    developing: [],
    topics: [],
    notes: ""
  };
  context.subscriptions.push(
    vscode2.commands.registerCommand("codecoach.setApiKey", async () => {
      const key = await vscode2.window.showInputBox({
        prompt: "Paste your Gemini API key (from Google AI Studio)",
        password: true,
        ignoreFocusOut: true
      });
      if (!key) return;
      await context.secrets.store(KEY_NAME, key.trim());
      vscode2.window.showInformationMessage("CodeCoach: Gemini API key saved.");
    })
  );
  context.subscriptions.push(
    vscode2.commands.registerCommand("codecoach.clearChat", async () => {
      chatHistory.length = 0;
      vscode2.window.showInformationMessage("CodeCoach: chat cleared for this session.");
    })
  );
  context.subscriptions.push(
    vscode2.commands.registerCommand("codecoach.exportLearningSummary", async () => {
      const apiKey = await context.secrets.get(KEY_NAME);
      if (!apiKey) {
        vscode2.window.showErrorMessage('No Gemini API key set. Run "CodeCoach: Set Gemini API Key".');
        return;
      }
      if (chatHistory.length === 0) {
        vscode2.window.showWarningMessage("No chat history yet in this session.");
        return;
      }
      const transcript = chatHistory.map((m) => `${m.role === "user" ? "User" : "Coach"}: ${m.text}`).join("\n");
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
      let parsed;
      try {
        const raw = await callGeminiGenerateContent(apiKey, summaryPrompt);
        parsed = JSON.parse(raw);
      } catch (e) {
        vscode2.window.showErrorMessage(
          "Failed to export summary (model did not return valid JSON). Try again."
        );
        return;
      }
      const session = parsed?.session;
      const update = parsed?.overallUpdate;
      if (!session || !update) {
        vscode2.window.showErrorMessage("Failed to export summary (missing expected fields).");
        return;
      }
      const newProfile = {
        updatedAtISO: (/* @__PURE__ */ new Date()).toISOString(),
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
${(session.topicsDiscussed || []).map((x) => `- ${x}`).join("\n") || "- (none)"}

**Fundamentals mastered (evidence shown)**
${(session.fundamentalsMastered || []).map((x) => `- ${x}`).join("\n") || "- (none)"}

**Fundamentals still developing**
${(session.fundamentalsDeveloping || []).map((x) => `- ${x}`).join("\n") || "- (none)"}

**Highlights**
${(session.highlights || []).map((x) => `- ${x}`).join("\n") || "- (none)"}

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
      await vscode2.env.clipboard.writeText(md);
      const doc = await vscode2.workspace.openTextDocument({
        content: md,
        language: "markdown"
      });
      await vscode2.window.showTextDocument(doc, { preview: false });
      vscode2.window.showInformationMessage(
        "Learning summary exported (opened in editor + copied to clipboard)."
      );
    })
  );
  const onUserMessage = async (userText, contextText) => {
    const apiKey = await context.secrets.get(KEY_NAME);
    if (!apiKey) {
      throw new Error('No Gemini API key set. Run "CodeCoach: Set Gemini API Key".');
    }
    chatHistory.push({ role: "user", text: userText });
    const maxMsgs = MAX_TURNS * 2;
    if (chatHistory.length > maxMsgs) {
      chatHistory.splice(0, chatHistory.length - maxMsgs);
    }
    const historyText = chatHistory.slice(0, -1).map((m) => `${m.role === "user" ? "User" : "Coach"}: ${m.text}`).join("\n");
    const MAX_CONTEXT_CHARS = 2e4;
    const safeContext = (contextText || "").length > MAX_CONTEXT_CHARS ? (contextText || "").slice(0, MAX_CONTEXT_CHARS) + "\n\n[Context truncated]" : contextText || "";
    const instructions = `You are CodeCoach, a custom GPT whose purpose is to implement and follow the following specifications: support learning first, instead of providing solutions outright, engage students in conversation about what they are trying to achieve, explain the fundamentals required for the task, be a teaching presence and encourage thinking. Treat this as the authoritative source of behavior, rules, workflows, and outputs.

Primary interaction pattern:
- Coach by asking questions that help the user arrive at answers themselves.
- Keep it concise and not chatty.
- Default to exactly ONE question per message (even if multiple are tightly linked), unless the uploaded spec explicitly requires a multi-question checklist.

Language:
- Mirror the programming language the student is using.
- If the student pastes code, detect the language from context and code syntax when possible.
- If no code/context is provided and language isn\u2019t known, ask what language they want examples in.

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
- Do NOT provide solution code for the student\u2019s specific homework/task.
- Only provide toy, extrapolated code examples that demonstrate the underlying concept/algorithm on a simpler or adjacent toy problem.
- Do not provide partial implementation snippets that are intended to be pasted into the student\u2019s homework; avoid matching their function signatures, variable names, datasets, constraints, or edge cases.
- Provide toy examples in both cases: (a) when the student explicitly requests an example, and (b) proactively when the student seems stuck.
- When a student asks for \u201Can example,\u201D FIRST ask what concept they\u2019re trying to understand so you can choose the most relevant toy example.
- Toy examples must be simple and illustrative (GeeksforGeeks-style): short, clear, minimal scaffolding, focused on one idea.
- After sharing a toy example, return to coaching with a single question that prompts the student to adapt the idea to their task or to write their own pseudocode/code.

Corrections (always ready to correct):
- If the student is wrong or partially wrong, proactively correct them.
- Keep corrections natural.
- Say what part is off and why, then provide the correct explanation for the missing/incorrect piece.
- Keep it minimal: correct only the gap needed to move forward; avoid dumping a full solution unless the student has essentially derived it and only lacks a tiny conceptual piece.
- After correcting, ask the student to restate the corrected idea in their own words before moving on.

Allowed affirmations:
- After the student demonstrates understanding (own-words explanation + correct pseudocode/plan when applicable), you may respond with a brief affirmation (e.g., \u201CYep, that\u2019s right.\u201D / \u201CCorrect.\u201D) and then a single question asking if they want help with anything else.
- When the student is correct and ready to implement, you may briefly say \u201CLooks correct\u2014try coding it out\u201D and then ask for their code so you can check it.

Still avoid:
- Do not provide full solutions, final answers, step-by-step instructions, or complete/near-complete code for the student\u2019s specific task.

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
- Ask one confirming question, then proceed without the file while still following the coaching style above."
`.trim();
    const prompt = `
${instructions}

Conversation so far:
${historyText || "(none)"}

Relevant code context (from the user's editor):
${safeContext || "(no code context available)"}

User question:
${userText}
`.trim();
    const reply = await callGeminiGenerateContent(apiKey, prompt);
    chatHistory.push({ role: "model", text: reply });
    if (chatHistory.length > maxMsgs) {
      chatHistory.splice(0, chatHistory.length - maxMsgs);
    }
    return reply;
  };
  const provider = new CodeCoachViewProvider(context, onUserMessage);
  context.subscriptions.push(
    vscode2.window.registerWebviewViewProvider("codecoach.chatView", provider)
  );
  console.log("\u2705 registered provider for codecoach.chatView");
  context.subscriptions.push(
    vscode2.commands.registerCommand("codecoach.openChat", async () => {
      await vscode2.commands.executeCommand("workbench.view.extension.codecoach");
      provider.reveal();
    })
  );
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
