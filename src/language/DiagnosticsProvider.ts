import * as vscode from "vscode";
import { OscMessage } from "../types/osc.js";

export class DiagnosticsProvider implements vscode.Disposable {
  private readonly _collection: vscode.DiagnosticCollection;
  private _disposables: vscode.Disposable[] = [];

  constructor() {
    this._collection =
      vscode.languages.createDiagnosticCollection("sonicpi");

    this._disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document.languageId === "sonicpi") {
          this._collection.delete(e.document.uri);
        }
      })
    );
  }

  handleMessage(msg: OscMessage): void {
    switch (msg.address) {
      case "/error":
        this.handleError(msg);
        break;
      case "/syntax_error":
        this.handleSyntaxError(msg);
        break;
    }
  }

  /**
   * /error args: [job_id, desc, backtrace, line]
   */
  private handleError(msg: OscMessage): void {
    const description = String(msg.args[1] ?? "");
    const line = this.extractLine(description, Number(msg.args[3] ?? 0));
    this.addDiagnostic(description, line, vscode.DiagnosticSeverity.Error);
  }

  /**
   * /syntax_error args: [job_id, desc, error_line, line, line_s]
   */
  private handleSyntaxError(msg: OscMessage): void {
    const description = String(msg.args[1] ?? "");
    const line = Number(msg.args[3] ?? 0);
    this.addDiagnostic(description, line, vscode.DiagnosticSeverity.Error);
  }

  private extractLine(description: string, fallback: number): number {
    const match = description.match(/line\s+(\d+)/i);
    return match ? Number(match[1]) : fallback;
  }

  private addDiagnostic(
    message: string,
    line: number,
    severity: vscode.DiagnosticSeverity
  ): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== "sonicpi") return;

    const uri = editor.document.uri;
    const lineNum = Math.max(0, line - 1);
    const range = new vscode.Range(lineNum, 0, lineNum, 1000);
    const diagnostic = new vscode.Diagnostic(range, message, severity);
    diagnostic.source = "Sonic Pi";

    const existing = this._collection.get(uri) || [];
    this._collection.set(uri, [...existing, diagnostic]);
  }

  clearAll(): void {
    this._collection.clear();
  }

  dispose(): void {
    for (const d of this._disposables) {
      d.dispose();
    }
    this._collection.dispose();
  }
}
