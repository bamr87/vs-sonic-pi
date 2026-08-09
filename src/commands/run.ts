import * as vscode from "vscode";
import { ConnectionManager } from "../connection/ConnectionManager.js";
import { DiagnosticsProvider } from "../language/DiagnosticsProvider.js";

/**
 * Stable buffer id for a document. Re-running the same file must reuse the
 * same server-side buffer (like the GUI's workspace_zero..nine) so Sonic Pi
 * replaces the previous job instead of accumulating new buffers.
 */
export function bufferIdForDocument(documentKey: string): string {
  // FNV-1a 32-bit
  let hash = 0x811c9dc5;
  for (let i = 0; i < documentKey.length; i++) {
    hash ^= documentKey.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `vscode-${(hash >>> 0).toString(36)}`;
}

export async function runBuffer(
  connectionManager: ConnectionManager,
  diagnostics?: DiagnosticsProvider
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("No active editor to run.");
    return;
  }

  const code = editor.document.getText();
  if (!code.trim()) return;

  const documentKey = editor.document.uri.toString();
  const bufferId = bufferIdForDocument(documentKey);
  const workspace = editor.document.uri.fsPath || "untitled";

  diagnostics?.beginRun(editor.document.uri);

  await connectionManager.transport!.send(
    "/save-and-run-buffer",
    bufferId,
    code,
    workspace
  );
}

export async function runSelection(
  connectionManager: ConnectionManager,
  diagnostics?: DiagnosticsProvider
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

  diagnostics?.beginRun(editor.document.uri);

  await connectionManager.transport!.send("/run-code", code);
}

/** Run an arbitrary snippet (used by the live_loop CodeLens). */
export async function runCode(
  connectionManager: ConnectionManager,
  code: string,
  documentUri?: vscode.Uri,
  diagnostics?: DiagnosticsProvider
): Promise<void> {
  if (!code.trim()) return;
  if (documentUri) {
    diagnostics?.beginRun(documentUri);
  }
  await connectionManager.transport!.send("/run-code", code);
}
