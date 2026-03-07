import * as vscode from "vscode";
import { readdir } from "fs/promises";
import { join } from "path";
import { ConnectionManager } from "../connection/ConnectionManager.js";
import { runBuffer, runSelection } from "./run.js";
import { stopAllJobs } from "./stop.js";

export class CommandHandler implements vscode.Disposable {
  private _disposables: vscode.Disposable[] = [];

  constructor(
    private readonly _connectionManager: ConnectionManager,
    private readonly _extensionPath?: string
  ) {}

  registerAll(context: vscode.ExtensionContext): void {
    this._register(context, "sonicpi.run", () =>
      this.withConnectionGuard(() => runBuffer(this._connectionManager))
    );

    this._register(context, "sonicpi.runSelection", () =>
      this.withConnectionGuard(() => runSelection(this._connectionManager))
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

    this._register(context, "sonicpi.openExamples", () =>
      this.openExamples(context)
    );

    this._register(context, "sonicpi.beautify", () =>
      this.withConnectionGuard(() => this.beautify())
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

  private async beautify(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const code = editor.document.getText();
    const bufferId = "vscode-beautify";

    const transport = this._connectionManager.transport!;

    const replacePromise = new Promise<string>((resolve) => {
      const timeout = setTimeout(() => {
        disposable.dispose();
        resolve(code);
      }, 5000);

      const disposable = transport.onMessage("/buffer/replace", (msg) => {
        clearTimeout(timeout);
        disposable.dispose();
        resolve(String(msg.args[1] ?? code));
      });
    });

    await transport.send("/buffer-beautify", bufferId, code);

    const beautified = await replacePromise;
    if (beautified !== code) {
      const fullRange = new vscode.Range(
        editor.document.positionAt(0),
        editor.document.positionAt(code.length)
      );
      await editor.edit((editBuilder) => {
        editBuilder.replace(fullRange, beautified);
      });
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
