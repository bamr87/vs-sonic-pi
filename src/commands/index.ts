import * as vscode from "vscode";
import { readdir } from "fs/promises";
import { join } from "path";
import { ConnectionManager } from "../connection/ConnectionManager.js";
import { DiagnosticsProvider } from "../language/DiagnosticsProvider.js";
import { LogManager } from "../log/LogManager.js";
import { runBuffer, runSelection, runCode } from "./run.js";
import { beautifyBuffer } from "./beautify.js";
import { stopAllJobs } from "./stop.js";

const NEW_LOOP_TEMPLATE = `# Welcome to Sonic Pi!
# Press F5 to run, Shift+F5 to stop.

use_bpm 120

live_loop :beat do
  sample :bd_haus
  sleep 1
end

live_loop :melody, sync: :beat do
  use_synth :prophet
  play scale(:e3, :minor_pentatonic).choose, release: 0.5, amp: 0.7
  sleep 0.5
end
`;

export class CommandHandler implements vscode.Disposable {
  private _disposables: vscode.Disposable[] = [];

  constructor(
    private readonly _connectionManager: ConnectionManager,
    private readonly _diagnostics?: DiagnosticsProvider,
    private readonly _logManager?: LogManager
  ) {}

  registerAll(context: vscode.ExtensionContext): void {
    this._register(context, "sonicpi.run", () =>
      this.withConnectionGuard(() =>
        runBuffer(this._connectionManager, this._diagnostics)
      )
    );

    this._register(context, "sonicpi.runSelection", () =>
      this.withConnectionGuard(() =>
        runSelection(this._connectionManager, this._diagnostics)
      )
    );

    this._register(
      context,
      "sonicpi.runLiveLoop",
      (uri: vscode.Uri, startLine: number, endLine: number) =>
        this.withConnectionGuard(() =>
          this.runLiveLoop(uri, startLine, endLine)
        )
    );

    this._register(context, "sonicpi.stop", () =>
      this.withConnectionGuard(() => stopAllJobs(this._connectionManager))
    );

    this._register(context, "sonicpi.connect", () =>
      this._connectionManager.connect()
    );

    this._register(context, "sonicpi.disconnect", () =>
      this._connectionManager.disconnect()
    );

    this._register(context, "sonicpi.restartDaemon", () =>
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Restarting Sonic Pi daemon…",
        },
        () => this._connectionManager.restartDaemon()
      )
    );

    this._register(context, "sonicpi.newLoop", () => this.newLoopFile());

    this._register(context, "sonicpi.openLog", () =>
      this._logManager?.show()
    );

    this._register(context, "sonicpi.openExamples", () =>
      this.openExamples(context)
    );

    this._register(context, "sonicpi.beautify", () =>
      this.withConnectionGuard(() => beautifyBuffer(this._connectionManager))
    );

    this._register(context, "sonicpi.startRecording", () =>
      this.withConnectionGuard(() =>
        this._connectionManager.transport!.send("/start-recording")
      )
    );

    this._register(context, "sonicpi.stopRecording", () =>
      this.withConnectionGuard(() =>
        this._connectionManager.transport!.send("/stop-recording")
      )
    );

    this._register(context, "sonicpi.saveRecording", () =>
      this.withConnectionGuard(() => this.saveRecording())
    );
  }

  private _register(
    context: vscode.ExtensionContext,
    command: string,
    callback: (...args: any[]) => any
  ): void {
    const disposable = vscode.commands.registerCommand(command, callback);
    context.subscriptions.push(disposable);
    this._disposables.push(disposable);
  }

  private async withConnectionGuard(
    action: () => Promise<void>
  ): Promise<void> {
    if (!this._connectionManager.isConnected) {
      const choice = await vscode.window.showErrorMessage(
        "Not connected to Sonic Pi.",
        "Connect"
      );
      if (choice === "Connect") {
        await this._connectionManager.connect();
        if (this._connectionManager.isConnected) {
          await action();
        }
      }
      return;
    }
    await action();
  }

  private async runLiveLoop(
    uri: vscode.Uri,
    startLine: number,
    endLine: number
  ): Promise<void> {
    const document = await vscode.workspace.openTextDocument(uri);
    const range = new vscode.Range(
      startLine,
      0,
      Math.min(endLine, document.lineCount - 1),
      Number.MAX_SAFE_INTEGER
    );
    const code = document.getText(document.validateRange(range));
    await runCode(this._connectionManager, code, uri, this._diagnostics);
  }

  private async newLoopFile(): Promise<void> {
    const document = await vscode.workspace.openTextDocument({
      language: "sonicpi",
      content: NEW_LOOP_TEMPLATE,
    });
    await vscode.window.showTextDocument(document);
  }

  private async openExamples(
    context: vscode.ExtensionContext
  ): Promise<void> {
    const examplesDir = join(context.extensionPath, "examples");
    const levels = await readdir(examplesDir).catch(() => [] as string[]);

    const items: vscode.QuickPickItem[] = [];
    for (const level of levels.sort()) {
      const files = await readdir(join(examplesDir, level)).catch(
        () => [] as string[]
      );
      for (const file of files.sort()) {
        if (file.endsWith(".spi")) {
          items.push({
            label: file.replace(".spi", ""),
            description: level,
            detail: join(examplesDir, level, file),
          });
        }
      }
    }

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: "Select a Sonic Pi example to open",
    });

    if (picked?.detail) {
      const doc = await vscode.workspace.openTextDocument(picked.detail);
      await vscode.window.showTextDocument(doc);
    }
  }

  private async saveRecording(): Promise<void> {
    const uri = await vscode.window.showSaveDialog({
      filters: { "WAV Audio": ["wav"] },
      defaultUri: vscode.Uri.file("sonic-pi-recording.wav"),
    });

    if (uri) {
      await this._connectionManager.transport!.send(
        "/save-recording",
        uri.fsPath
      );
      vscode.window.showInformationMessage(
        `Recording saved to ${uri.fsPath}`
      );
    }
  }

  dispose(): void {
    for (const d of this._disposables) {
      d.dispose();
    }
    this._disposables = [];
  }
}
