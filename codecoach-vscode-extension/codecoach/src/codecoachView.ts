import * as vscode from "vscode";

function getNonce() {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export class CodeCoachViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "codecoach.chatView";

  private _view?: vscode.WebviewView;
  private _lastStatusText =
    "Account: Not connected - Student: Not signed in - Assignment: None";

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly onUserMessage: (
      userText: string,
      contextText: string
    ) => Promise<string>
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (msg?.type === "ready") {
        this._view?.webview.postMessage({
          type: "status",
          text: this._lastStatusText,
        });
        return;
      }

      if (msg?.type === "send") {
        try {
          const editor = vscode.window.activeTextEditor;
          const contextText = editor?.document.getText() ?? "";

          const reply = await this.onUserMessage(msg.text, contextText);

          webviewView.webview.postMessage({
            type: "assistant",
            text: reply,
          });
        } catch (err: any) {
          webviewView.webview.postMessage({
            type: "assistant",
            text: `Error: ${err?.message ?? String(err)}`,
          });
        } finally {
          webviewView.webview.postMessage({ type: "done" });
        }
      }
    });

    const nonce = getNonce();
    webviewView.webview.html = this.getHtml(nonce);
  }

  reveal() {
    this._view?.show?.(true);
  }

  postStatus(text: string) {
    if (text && text.trim()) {
      this._lastStatusText = text.trim();
    }

    if (this._view) {
      this._view.webview.postMessage({
        type: "status",
        text: this._lastStatusText,
      });
    }
  }

  private getHtml(nonce: string): string {
    return `<!DOCTYPE html>
  <html lang="en">
  <head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <meta http-equiv="Content-Security-Policy"
    content="
      default-src 'none';
      img-src https: data:;
      style-src 'unsafe-inline';
      script-src 'nonce-${nonce}';
    " />

  <style>
    :root { color-scheme: light dark; }

    body {
      margin: 0;
      font-family: var(--vscode-font-family);
      background: var(--vscode-sideBar-background);
      color: var(--vscode-sideBar-foreground);
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    .header {
      padding: 14px 16px;
      font-weight: 600;
      font-size: 15px;
      background: linear-gradient(90deg, #5b2d91, #6e3bbf);
      color: white;
      letter-spacing: 0.3px;
    }

    .status {
      padding: 8px 16px;
      font-size: 12px;
      opacity: 0.85;
      border-bottom: 1px solid var(--vscode-sideBar-border);
    }

    #chat {
      flex: 1;
      overflow-y: auto;
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .row { display: flex; }
    .row.user { justify-content: flex-end; }
    .row.assistant { justify-content: flex-start; }

    .bubble {
      max-width: 85%;
      padding: 13px 15px;
      border-radius: 16px;
      line-height: 1.55;
      white-space: pre-wrap;
      word-break: break-word;
      box-shadow: 0 3px 8px rgba(0,0,0,0.08);
      font-size: 13px;
    }

    .bubble.user {
      background: linear-gradient(135deg, #5b2d91, #6e3bbf);
      color: white;
    }

    .bubble.assistant {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-editorWidget-border);
    }

    .thinking {
      padding: 6px 18px;
      font-size: 12px;
      opacity: 0.7;
    }

    .composer {
      display: flex;
      gap: 12px;
      padding: 16px;
      border-top: 1px solid var(--vscode-sideBar-border);
      background: var(--vscode-sideBar-background);
    }

    textarea {
      flex: 1;
      resize: none;
      padding: 11px 14px;
      border-radius: 14px;
      border: 1px solid var(--vscode-input-border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      font-family: inherit;
      font-size: 13px;
    }

    textarea:focus {
      outline: none;
      border-color: #6e3bbf;
    }

    button {
      padding: 11px 18px;
      border-radius: 14px;
      border: none;
      cursor: pointer;
      font-weight: 600;
      background: linear-gradient(135deg, #5b2d91, #6e3bbf);
      color: white;
      font-size: 13px;
    }

    button:hover {
      opacity: 0.92;
    }

    button:disabled {
      opacity: 0.6;
      cursor: default;
    }
  </style>
  </head>
  <body>

  <div class="header">CodeCoach</div>
  <div class="status" id="status">${this._lastStatusText}</div>

  <div id="chat"></div>

  <div id="thinking" class="thinking" style="display:none;">
    CodeCoach is thinking...
  </div>

  <div class="composer">
    <textarea id="input"
      placeholder="Ask CodeCoach... (Enter to send, Shift+Enter for newline)"
      rows="2"></textarea>
    <button id="sendBtn">Send</button>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const chat = document.getElementById("chat");
    const input = document.getElementById("input");
    const sendBtn = document.getElementById("sendBtn");
    const thinking = document.getElementById("thinking");
    const status = document.getElementById("status");

    function scrollToBottom() {
      chat.scrollTop = chat.scrollHeight;
    }

    function addMessage(role, text) {
      const row = document.createElement("div");
      row.className = "row " + role;

      const bubble = document.createElement("div");
      bubble.className = "bubble " + role;
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

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendCurrent();
      }
    });

    sendBtn.addEventListener("click", sendCurrent);

    window.addEventListener("message", (event) => {
      const msg = event.data;
      if (!msg || !msg.type) return;

      if (msg.type === "assistant") addMessage("assistant", msg.text || "");
      if (msg.type === "status") status.textContent = msg.text || "";
      if (msg.type === "done") {
        setBusy(false);
        input.focus();
      }
    });

    vscode.postMessage({ type: "ready" });
    input.focus();
  </script>
  </body>
  </html>`;
  }
}