import * as vscode from "vscode";

export class AudioStreamWebview implements vscode.Disposable {
  private _panel: vscode.WebviewPanel | undefined;

  constructor(private readonly _port: number) {}

  private static makeNonce(): string {
    return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }

  private getSafePort(): number {
    return Number.isInteger(this._port) && this._port > 0 && this._port <= 65535
      ? this._port
      : 8080;
  }

  open(): void {
    if (this._panel) {
      this._panel.reveal();
      return;
    }

    this._panel = vscode.window.createWebviewPanel(
      "sonicpiAudioStream",
      "Sonic Pi — Audio Stream",
      vscode.ViewColumn.Beside,
      { enableScripts: true }
    );

    this._panel.onDidDispose(() => {
      this._panel = undefined;
    });

    this._panel.webview.html = this.renderHtml();
  }

  private renderHtml(): string {
    const streamUrl = `http://localhost:${this.getSafePort()}`;
    const nonce = AudioStreamWebview.makeNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; media-src http://localhost:*; img-src data:;">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .container {
      text-align: center;
      max-width: 400px;
      width: 100%;
    }
    h1 {
      font-size: 1.3em;
      margin-bottom: 8px;
      font-weight: 600;
    }
    .subtitle {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      margin-bottom: 24px;
    }
    .player-card {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 20px;
      background: var(--vscode-sideBar-background);
    }
    .status {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-bottom: 16px;
      font-size: 12px;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--vscode-descriptionForeground);
    }
    .status-dot.connected { background: #4ec9b0; }
    .status-dot.error { background: #f44747; }
    .btn {
      padding: 8px 24px;
      border: none;
      border-radius: 4px;
      font-size: 13px;
      font-family: inherit;
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .btn-primary:hover { background: var(--vscode-button-hoverBackground); }
    .btn-secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      margin-left: 8px;
    }
    .btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .controls { margin-top: 12px; }
    .info {
      margin-top: 16px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.5;
    }
    .url {
      font-family: var(--vscode-editor-font-family, monospace);
      background: var(--vscode-textCodeBlock-background);
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
      user-select: all;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Sonic Pi Audio</h1>
    <p class="subtitle">Stream audio from your Codespace</p>

    <div class="player-card">
      <div class="status">
        <span class="status-dot" id="statusDot"></span>
        <span id="statusText">Disconnected</span>
      </div>

      <div class="controls">
        <button class="btn btn-primary" id="playBtn" onclick="togglePlay()">Listen</button>
        <button class="btn btn-secondary" id="extBtn" onclick="openExternal()">Open in Browser</button>
      </div>

      <div class="info">
        <p>Stream URL: <span class="url">${streamUrl}</span></p>
        <p style="margin-top: 8px;">
          Audio is streamed from the Codespace via PulseAudio.
          Expect ~200-500ms latency over the network.
        </p>
      </div>
    </div>
  </div>

  <script nonce="${nonce}">
    let audio = null;
    let playing = false;
    const streamUrl = "${streamUrl}";

    function togglePlay() {
      if (playing) {
        stop();
      } else {
        play();
      }
    }

    function play() {
      if (audio) {
        audio.pause();
        audio = null;
      }
      setStatus("connecting", "Connecting...");

      audio = new Audio(streamUrl);
      audio.crossOrigin = "anonymous";

      audio.addEventListener("playing", () => {
        playing = true;
        setStatus("connected", "Streaming");
        document.getElementById("playBtn").textContent = "Stop";
      });

      audio.addEventListener("error", () => {
        playing = false;
        setStatus("error", "Connection failed — is the audio stream running?");
        document.getElementById("playBtn").textContent = "Retry";
      });

      audio.addEventListener("ended", () => {
        playing = false;
        setStatus("disconnected", "Stream ended");
        document.getElementById("playBtn").textContent = "Listen";
      });

      audio.play().catch(() => {
        setStatus("error", "Playback blocked — click Listen again");
        document.getElementById("playBtn").textContent = "Listen";
      });
    }

    function stop() {
      if (audio) {
        audio.pause();
        audio.src = "";
        audio = null;
      }
      playing = false;
      setStatus("disconnected", "Stopped");
      document.getElementById("playBtn").textContent = "Listen";
    }

    function openExternal() {
      const a = document.createElement("a");
      a.href = streamUrl;
      a.target = "_blank";
      a.click();
    }

    function setStatus(state, text) {
      const dot = document.getElementById("statusDot");
      dot.className = "status-dot " + (state === "connecting" ? "" : state);
      document.getElementById("statusText").textContent = text;
    }
  </script>
</body>
</html>`;
  }

  dispose(): void {
    this._panel?.dispose();
  }
}
