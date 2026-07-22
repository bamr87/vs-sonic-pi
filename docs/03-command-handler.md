# Command Handler

**Module:** `src/commands/index.ts`, `src/commands/run.ts`, `src/commands/stop.ts`, `src/commands/record.ts`, `src/commands/beautify.ts`  
**Phase:** 1 (MVP) for Run/Stop; Phase 2–3 for others  
**Dependencies:** `ConnectionManager`, `OscTransport`, `ConfigManager`

---

## Purpose

The Command Handler maps VS Code commands to Sonic Pi OSC messages. When the user presses F5, selects "Sonic Pi: Run" from the command palette, or clicks a button, the corresponding command function reads the editor state, constructs the correct OSC message, and sends it through the transport.

---

## Responsibilities

1. **Register** all `sonicpi.*` commands with the VS Code command system.
2. **Guard** commands that require a connection — show an error if disconnected.
3. **Read editor state** — get the active file's contents, path, selection, and language.
4. **Construct and send** the appropriate OSC message.
5. **Handle responses** where applicable (e.g., `/replace-buffer` after beautify).

---

## Command Registry

All commands are registered in `src/commands/index.ts` during `activate()`:

```typescript
export function registerCommands(
  context: vscode.ExtensionContext,
  connectionManager: ConnectionManager,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('sonicpi.run', () => runBuffer(connectionManager)),
    vscode.commands.registerCommand('sonicpi.runSelection', () => runSelection(connectionManager)),
    vscode.commands.registerCommand('sonicpi.stop', () => stopAll(connectionManager)),
    vscode.commands.registerCommand('sonicpi.connect', () => connectionManager.connect()),
    vscode.commands.registerCommand('sonicpi.disconnect', () => connectionManager.disconnect()),
    vscode.commands.registerCommand('sonicpi.openExamples', () => openExamples(context)),
    vscode.commands.registerCommand('sonicpi.startRecording', () => startRecording(connectionManager)),
    vscode.commands.registerCommand('sonicpi.stopRecording', () => stopRecording(connectionManager)),
    vscode.commands.registerCommand('sonicpi.saveRecording', () => saveRecording(connectionManager)),
    vscode.commands.registerCommand('sonicpi.beautify', () => beautifyBuffer(connectionManager)),
  );
}
```

---

## Command Specifications

### sonicpi.run — Run Buffer

**Phase:** 1 (MVP)  
**Keybinding:** `F5` (when `editorLangId == sonicpi`)  
**OSC message:** `/save-and-run-buffer`

| Step | Detail |
|------|--------|
| 1 | Check connection state. If not `Connected`, show error and return. |
| 2 | Get the active text editor. If none, show warning: "No active editor." |
| 3 | Read the full document text. |
| 4 | Derive a **stable buffer id** from the document URI (FNV-1a hash, `vscode-<hash>`). Re-running the same document reuses the same server-side buffer — mirroring the GUI's fixed `workspace_zero..nine` ids — so Sonic Pi replaces the previous job instead of accumulating buffers. |
| 5 | Determine `workspace`: the file's `fsPath`, or `"untitled"` if unsaved. |
| 6 | Clear diagnostics for the previous run (`DiagnosticsProvider.beginRun`). |
| 7 | Send `/save-and-run-buffer` with args `[buffer_id, code, workspace]`. |

```typescript
async function runBuffer(cm: ConnectionManager): Promise<void> {
  const transport = requireConnection(cm);
  if (!transport) return;

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor to run.');
    return;
  }

  const code = editor.document.getText();
  const filename = editor.document.isUntitled
    ? 'untitled'
    : editor.document.uri.fsPath;
  const workspace = vscode.workspace.workspaceFolders?.[0]?.name ?? 'default';

  transport.send('/save-and-run-buffer', filename, code, workspace);
}
```

### sonicpi.runSelection — Run Selection

**Phase:** 2  
**Keybinding:** `Ctrl+F5` / `Cmd+F5` (when `editorLangId == sonicpi`)  
**OSC message:** `/run-code`

| Step | Detail |
|------|--------|
| 1 | Check connection. |
| 2 | Get the active editor and its selection. |
| 3 | If selection is empty, fall back to running the entire buffer (delegate to `runBuffer`). |
| 4 | Read only the selected text. |
| 5 | Send `/run-code` with args `["vscode", selectedCode]`. |

The `/run-code` endpoint is designed for alternative front-ends and does not require a filename or workspace.

### sonicpi.stop — Stop All

**Phase:** 1 (MVP)  
**Keybinding:** `Shift+F5` (when `editorLangId == sonicpi`)  
**OSC message:** `/stop-all-jobs`

| Step | Detail |
|------|--------|
| 1 | Check connection. |
| 2 | Send `/stop-all-jobs` (no arguments). |

This is the simplest command. It kills all running threads in the Sonic Pi server.

### sonicpi.connect / sonicpi.disconnect

**Phase:** 1 (MVP)  
**Keybinding:** None (invoked via command palette or status bar click)

These delegate directly to `ConnectionManager.connect()` and `ConnectionManager.disconnect()`. No additional logic.

### sonicpi.openExamples — Open Examples

**Phase:** 2  
**Keybinding:** None

| Step | Detail |
|------|--------|
| 1 | Resolve the `examples/` directory bundled with the extension. |
| 2 | List all `.spi` files. |
| 3 | Show a VS Code Quick Pick with the file names. |
| 4 | On selection, open the file in a new editor tab (read-only or copied to a temp location for editing). |

Does **not** require a connection — examples are local files.

### sonicpi.startRecording / stopRecording / saveRecording

**Phase:** 3  
**Keybinding:** None

| Command | OSC | Notes |
|---------|-----|-------|
| `startRecording` | `/start-recording` | Tells SuperCollider to begin recording to a temp file. |
| `stopRecording` | `/stop-recording` | Stops recording. |
| `saveRecording` | `/save-recording` | Prompts user for a save path via `vscode.window.showSaveDialog`, then sends the chosen path as the argument. |

### sonicpi.beautify — Beautify Buffer

**Phase:** 3  
**Keybinding:** None (could bind to `Shift+Alt+F` as a formatter)  
**OSC message:** `/beautify-buffer`

| Step | Detail |
|------|--------|
| 1 | Check connection. |
| 2 | Send `/beautify-buffer`. |
| 3 | Listen for `/replace-buffer` response. |
| 4 | When received, replace the active editor's content with the returned code, preserving cursor position. |

The `/replace-buffer` response includes: `id`, `code`, `line`, `index`, `firstLineVisible`. The handler uses these to apply the edit and restore the viewport.

---

## Connection Guard

A shared utility ensures commands that need a connection fail gracefully:

```typescript
function requireConnection(cm: ConnectionManager): OscTransport | null {
  const transport = cm.getTransport();
  if (!transport) {
    vscode.window.showErrorMessage(
      'Not connected to Sonic Pi. Start the Sonic Pi application and connect first.',
      'Connect',
    ).then((choice) => {
      if (choice === 'Connect') cm.connect();
    });
    return null;
  }
  return transport;
}
```

---

## When Clauses

Commands use VS Code `when` clauses to control visibility and keybinding activation:

| Context Key | Set by | Value |
|-------------|--------|-------|
| `sonicpi.connected` | ConnectionManager (on state change) | `true` when Connected |
| `editorLangId` | VS Code (automatic) | `"sonicpi"` for `.spi` files |

Keybindings in `package.json`:

```jsonc
{ "command": "sonicpi.run",  "key": "f5",       "when": "editorLangId == sonicpi" }
{ "command": "sonicpi.stop", "key": "shift+f5", "when": "editorLangId == sonicpi" }
```

The Run command does not require `sonicpi.connected` in its `when` clause because it will auto-connect if needed (or show a helpful error). This avoids the confusing situation where F5 does nothing at all.

---

## Testing

### Unit Tests

| Test | Description |
|------|-------------|
| `runBuffer sends /save-and-run-buffer` | Mock editor with content "play 60". Verify transport receives `/save-and-run-buffer` with correct args. |
| `runBuffer shows error when disconnected` | Set connection state to Disconnected. Call run. Verify error message shown, no OSC sent. |
| `runBuffer handles no active editor` | No editor open. Call run. Verify warning shown. |
| `runSelection sends selected text` | Mock editor with selection "sample :bd_haus". Verify `/run-code` sent with selection only. |
| `runSelection falls back to full buffer` | Mock editor with empty selection. Verify delegates to runBuffer behavior. |
| `stop sends /stop-all-jobs` | Verify transport receives `/stop-all-jobs` with no args. |
| `openExamples shows quick pick` | Verify Quick Pick shown with example file names. |
| `beautify sends and applies response` | Send `/beautify-buffer`, simulate `/replace-buffer` response. Verify editor content updated. |
