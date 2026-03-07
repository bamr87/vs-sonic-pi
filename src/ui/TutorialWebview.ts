import * as vscode from "vscode";
import { readFileSync } from "fs";
import { join } from "path";

export class TutorialWebview {
  private _panel: vscode.WebviewPanel | undefined;

  constructor(private readonly _extensionPath: string) {}

  openChapter(filename: string): void {
    const tutorialPath = join(this._extensionPath, "media", "tutorial");
    const filePath = join(tutorialPath, filename);

    let content: string;
    try {
      content = readFileSync(filePath, "utf-8");
    } catch {
      vscode.window.showErrorMessage(`Could not open tutorial: ${filename}`);
      return;
    }

    if (!this._panel) {
      this._panel = vscode.window.createWebviewPanel(
        "sonicpiTutorial",
        "Sonic Pi Tutorial",
        vscode.ViewColumn.Beside,
        {
          enableScripts: false,
          localResourceRoots: [
            vscode.Uri.file(join(this._extensionPath, "media")),
          ],
        }
      );

      this._panel.onDidDispose(() => {
        this._panel = undefined;
      });
    }

    const title = this.extractTitle(content);
    this._panel.title = title || "Sonic Pi Tutorial";
    this._panel.webview.html = this.renderHtml(content, tutorialPath);
  }

  private extractTitle(content: string): string {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1] : "Sonic Pi Tutorial";
  }

  private renderHtml(markdown: string, tutorialPath: string): string {
    const html = this.markdownToHtml(markdown, tutorialPath);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
      font-size: var(--vscode-font-size, 14px);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 20px 30px;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
    }
    h1 { font-size: 1.8em; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 8px; }
    h2 { font-size: 1.4em; margin-top: 1.5em; }
    h3 { font-size: 1.2em; }
    code {
      font-family: var(--vscode-editor-font-family, monospace);
      background: var(--vscode-textCodeBlock-background);
      padding: 2px 5px;
      border-radius: 3px;
      font-size: 0.9em;
    }
    pre {
      background: var(--vscode-textCodeBlock-background);
      padding: 12px 16px;
      border-radius: 6px;
      overflow-x: auto;
      border: 1px solid var(--vscode-panel-border);
    }
    pre code { background: none; padding: 0; }
    a { color: var(--vscode-textLink-foreground); }
    blockquote {
      border-left: 3px solid var(--vscode-textBlockQuote-border);
      margin-left: 0;
      padding-left: 16px;
      color: var(--vscode-textBlockQuote-foreground);
    }
    img { max-width: 100%; border-radius: 4px; }
    ul, ol { padding-left: 24px; }
    hr { border: none; border-top: 1px solid var(--vscode-panel-border); margin: 2em 0; }
  </style>
</head>
<body>
${html}
</body>
</html>`;
  }

  private markdownToHtml(md: string, _tutorialPath: string): string {
    let html = md;

    html = html.replace(/^\d+(\.\d+)?\s+.+\n/, "");

    html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
      return `<pre><code>${this.escapeHtml(code.trim())}</code></pre>`;
    });

    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

    html = html.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2">$1</a>'
    );

    html = html.replace(/^---$/gm, "<hr>");

    html = html
      .split("\n\n")
      .map((block) => {
        const trimmed = block.trim();
        if (!trimmed) return "";
        if (trimmed.startsWith("<")) return trimmed;
        return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
      })
      .join("\n");

    return html;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  dispose(): void {
    this._panel?.dispose();
  }
}
