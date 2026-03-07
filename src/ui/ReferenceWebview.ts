import * as vscode from "vscode";
import type { SonicPiData } from "../types/sonicpi.js";

type ReferenceSection = "synths" | "fx" | "samples" | "scales" | "chords" | "functions";

export class ReferenceWebview {
  private _panel: vscode.WebviewPanel | undefined;

  constructor(private readonly _data: SonicPiData) {}

  open(section?: ReferenceSection): void {
    if (!this._panel) {
      this._panel = vscode.window.createWebviewPanel(
        "sonicpiReference",
        "Sonic Pi Reference",
        vscode.ViewColumn.Beside,
        { enableScripts: true },
      );
      this._panel.onDidDispose(() => {
        this._panel = undefined;
      });

      this._panel.webview.onDidReceiveMessage((msg) => {
        if (msg.type === "navigate") {
          this.updateContent(msg.section);
        } else if (msg.type === "insertCode") {
          this.insertCode(msg.code);
        }
      });
    }

    this.updateContent(section || "synths");
  }

  private updateContent(section: ReferenceSection): void {
    if (!this._panel) return;
    this._panel.title = `Sonic Pi — ${section.charAt(0).toUpperCase() + section.slice(1)}`;
    this._panel.webview.html = this.renderHtml(section);
  }

  private async insertCode(code: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      await editor.edit((edit) => {
        edit.insert(editor.selection.active, code);
      });
    }
  }

  private renderHtml(section: ReferenceSection): string {
    const body = this.renderSection(section);
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      margin: 0;
      padding: 0;
    }
    .nav {
      display: flex;
      gap: 0;
      border-bottom: 1px solid var(--vscode-panel-border);
      background: var(--vscode-sideBar-background);
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .nav button {
      flex: 1;
      padding: 8px 4px;
      border: none;
      background: transparent;
      color: var(--vscode-foreground);
      cursor: pointer;
      font-size: 12px;
      font-family: inherit;
      border-bottom: 2px solid transparent;
      transition: all 0.15s;
    }
    .nav button:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .nav button.active {
      border-bottom-color: var(--vscode-focusBorder);
      color: var(--vscode-textLink-foreground);
      font-weight: 600;
    }
    .content { padding: 16px 20px; }
    h1 { font-size: 1.4em; margin: 0 0 16px 0; }
    .card {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      margin-bottom: 12px;
      overflow: hidden;
    }
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: var(--vscode-sideBar-background);
      cursor: pointer;
      user-select: none;
    }
    .card-header:hover { background: var(--vscode-list-hoverBackground); }
    .card-title {
      font-weight: 600;
      font-size: 13px;
    }
    .card-title code {
      font-family: var(--vscode-editor-font-family, monospace);
      color: var(--vscode-textLink-foreground);
    }
    .card-subtitle {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
    .card-body {
      padding: 10px 12px;
      font-size: 12px;
      line-height: 1.5;
      display: none;
    }
    .card.open .card-body { display: block; }
    .card.open .card-header { border-bottom: 1px solid var(--vscode-panel-border); }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      margin-top: 8px;
    }
    th, td {
      text-align: left;
      padding: 4px 8px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    th {
      font-weight: 600;
      background: var(--vscode-sideBar-background);
    }
    code {
      font-family: var(--vscode-editor-font-family, monospace);
      background: var(--vscode-textCodeBlock-background);
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 0.95em;
    }
    pre {
      background: var(--vscode-textCodeBlock-background);
      padding: 8px 12px;
      border-radius: 4px;
      overflow-x: auto;
      border: 1px solid var(--vscode-panel-border);
      position: relative;
    }
    pre code { background: none; padding: 0; }
    .insert-btn {
      position: absolute;
      top: 4px;
      right: 4px;
      padding: 2px 8px;
      font-size: 10px;
      border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border-radius: 3px;
      cursor: pointer;
    }
    .insert-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .tag {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 10px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      margin-right: 4px;
    }
    .search-box {
      width: 100%;
      padding: 6px 10px;
      margin-bottom: 12px;
      border: 1px solid var(--vscode-input-border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border-radius: 4px;
      font-size: 13px;
      font-family: inherit;
      outline: none;
    }
    .search-box:focus { border-color: var(--vscode-focusBorder); }
    .empty { color: var(--vscode-descriptionForeground); text-align: center; padding: 20px; }
  </style>
</head>
<body>
  <div class="nav">
    <button ${section === "synths" ? 'class="active"' : ""} onclick="navigate('synths')">Synths</button>
    <button ${section === "fx" ? 'class="active"' : ""} onclick="navigate('fx')">FX</button>
    <button ${section === "samples" ? 'class="active"' : ""} onclick="navigate('samples')">Samples</button>
    <button ${section === "scales" ? 'class="active"' : ""} onclick="navigate('scales')">Scales</button>
    <button ${section === "chords" ? 'class="active"' : ""} onclick="navigate('chords')">Chords</button>
    <button ${section === "functions" ? 'class="active"' : ""} onclick="navigate('functions')">Functions</button>
  </div>
  <div class="content">
    <input class="search-box" type="text" placeholder="Search ${section}..." oninput="filterCards(this.value)" />
    ${body}
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    function navigate(section) {
      vscode.postMessage({ type: 'navigate', section });
    }
    function insertCode(code) {
      vscode.postMessage({ type: 'insertCode', code });
    }
    function toggleCard(el) {
      el.closest('.card').classList.toggle('open');
    }
    function filterCards(query) {
      const q = query.toLowerCase();
      document.querySelectorAll('.card').forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(q) ? '' : 'none';
      });
    }
  </script>
</body>
</html>`;
  }

  private renderSection(section: ReferenceSection): string {
    switch (section) {
      case "synths": return this.renderSynths();
      case "fx": return this.renderFx();
      case "samples": return this.renderSamples();
      case "scales": return this.renderScales();
      case "chords": return this.renderChords();
      case "functions": return this.renderFunctions();
    }
  }

  private renderSynths(): string {
    return this._data.synths.map((s) => {
      const optRows = Object.entries(s.opts)
        .map(([name, info]) =>
          `<tr><td><code>${name}</code></td><td>${info.default}</td><td>${info.doc}</td></tr>`
        ).join("");
      const optsTable = optRows
        ? `<table><tr><th>Option</th><th>Default</th><th>Description</th></tr>${optRows}</table>`
        : "";
      const example = `use_synth :${s.key}\nplay 60`;
      return this.card(
        `:${s.key}`,
        s.name,
        `<p>${this.esc(s.doc)}</p>${optsTable}`,
        example,
      );
    }).join("");
  }

  private renderFx(): string {
    return this._data.fx.map((f) => {
      const optRows = Object.entries(f.opts)
        .map(([name, info]) =>
          `<tr><td><code>${name}</code></td><td>${info.default}</td><td>${info.doc}</td></tr>`
        ).join("");
      const optsTable = optRows
        ? `<table><tr><th>Option</th><th>Default</th><th>Description</th></tr>${optRows}</table>`
        : "";
      const example = `with_fx :${f.key} do\n  play 60\nend`;
      return this.card(
        `:${f.key}`,
        f.name,
        `<p>${this.esc(f.doc)}</p>${optsTable}`,
        example,
      );
    }).join("");
  }

  private renderSamples(): string {
    let html = "";
    for (const [group, samples] of Object.entries(this._data.samples)) {
      html += `<h2>${this.esc(group)}</h2>`;
      html += samples.map((s) => {
        const example = `sample :${s.name}`;
        return this.card(`:${s.name}`, group, "", example);
      }).join("");
    }
    return html;
  }

  private renderScales(): string {
    return (this._data.scales ?? []).map((s) => {
      const intervals = s.intervals.length > 0
        ? `<p>Intervals: <code>[${s.intervals.join(", ")}]</code></p>`
        : `<p><em>Microtonal scale (Turkish makam)</em></p>`;
      const example = `play_pattern_timed scale(:C4, :${s.name}), 0.25`;
      return this.card(`:${s.name}`, "Scale", intervals, example);
    }).join("");
  }

  private renderChords(): string {
    return (this._data.chords ?? []).map((c) => {
      const intervals = `<p>Intervals: <code>[${c.intervals.join(", ")}]</code></p>`;
      const example = `play chord(:C4, :${c.name})`;
      return this.card(`:${c.name}`, "Chord", intervals, example);
    }).join("");
  }

  private renderFunctions(): string {
    const categories = new Map<string, typeof this._data.functions>();
    for (const fn of this._data.functions) {
      const cat = fn.category || "other";
      if (!categories.has(cat)) categories.set(cat, []);
      categories.get(cat)!.push(fn);
    }

    let html = "";
    for (const [cat, fns] of categories) {
      html += `<h2>${cat.charAt(0).toUpperCase() + cat.slice(1)}</h2>`;
      html += fns.map((fn) => {
        let body = `<p>${this.esc(fn.doc)}</p>`;
        if (fn.args && fn.args.length > 0) {
          body += `<p><strong>Args:</strong> ${fn.args.map((a) => `<code>${a}</code>`).join(", ")}</p>`;
        }
        if (fn.examples && fn.examples.length > 0) {
          body += fn.examples.slice(0, 2).map((ex) =>
            `<pre><code>${this.esc(ex)}</code><button class="insert-btn" onclick="insertCode(${JSON.stringify(ex)})">Insert</button></pre>`
          ).join("");
        }
        return this.card(
          fn.name,
          `<span class="tag">${fn.category}</span>${fn.summary || ""}`,
          body,
        );
      }).join("");
    }
    return html;
  }

  private card(title: string, subtitle: string, body: string, example?: string): string {
    const exampleHtml = example
      ? `<pre><code>${this.esc(example)}</code><button class="insert-btn" onclick="insertCode(${JSON.stringify(example)})">Insert</button></pre>`
      : "";
    return `<div class="card">
  <div class="card-header" onclick="toggleCard(this)">
    <span class="card-title"><code>${this.esc(title)}</code></span>
    <span class="card-subtitle">${subtitle}</span>
  </div>
  <div class="card-body">${body}${exampleHtml}</div>
</div>`;
  }

  private esc(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  dispose(): void {
    this._panel?.dispose();
  }
}
