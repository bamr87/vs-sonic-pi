import * as vscode from "vscode";
import { ConnectionManager } from "../connection/ConnectionManager.js";
import { bufferIdForDocument } from "./run.js";

const BEAUTIFY_TIMEOUT_MS = 5000;

/**
 * /buffer-beautify expects [id, buf, line, index, first_line] (the cursor
 * position, so the server can report back where to restore it). The server
 * replies with /buffer/replace [id, content, line, index, first_line].
 */
export async function beautifyBuffer(
  connectionManager: ConnectionManager
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const document = editor.document;
  const code = document.getText();
  if (!code.trim()) return;

  const bufferId = bufferIdForDocument(document.uri.toString());
  const cursor = editor.selection.active;
  const firstVisibleLine = editor.visibleRanges[0]?.start.line ?? 0;

  const reply = await connectionManager.transport!.request(
    "/buffer-beautify",
    "/buffer/replace",
    BEAUTIFY_TIMEOUT_MS,
    bufferId,
    code,
    cursor.line,
    cursor.character,
    firstVisibleLine
  );

  if (!reply) {
    vscode.window.showWarningMessage(
      "Sonic Pi did not respond to the beautify request."
    );
    return;
  }

  const beautified = String(reply.args[1] ?? code);
  if (beautified === code) return;

  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(code.length)
  );
  const applied = await editor.edit((editBuilder) => {
    editBuilder.replace(fullRange, beautified);
  });

  if (applied) {
    const line = Number(reply.args[2] ?? cursor.line);
    const index = Number(reply.args[3] ?? cursor.character);
    const position = document.validatePosition(
      new vscode.Position(line, index)
    );
    editor.selection = new vscode.Selection(position, position);
  }
}
