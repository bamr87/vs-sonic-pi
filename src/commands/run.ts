import * as vscode from "vscode";
import { ConnectionManager } from "../connection/ConnectionManager.js";

let _runCounter = 0;

export async function runBuffer(
  connectionManager: ConnectionManager
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("No active editor to run.");
    return;
  }

  const code = editor.document.getText();
  if (!code.trim()) return;

  const bufferId = `vscode-${_runCounter++}`;
  const workspace = editor.document.uri.fsPath || "untitled";

  await connectionManager.transport!.send(
    "/save-and-run-buffer",
    bufferId,
    code,
    workspace
  );
}

export async function runSelection(
  connectionManager: ConnectionManager
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("No active editor to run.");
    return;
  }

  const selection = editor.selection;
  const code = selection.isEmpty
    ? editor.document.lineAt(selection.active.line).text
    : editor.document.getText(selection);

  if (!code.trim()) return;

  await connectionManager.transport!.send("/run-code", code);
}
