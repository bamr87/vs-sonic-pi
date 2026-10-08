import * as vscode from "vscode";
import { LogLevel, SonicPiConfig } from "../types/sonicpi.js";

export class ConfigManager implements vscode.Disposable {
  private readonly _onDidChangeConfig =
    new vscode.EventEmitter<SonicPiConfig>();
  readonly onDidChangeConfig = this._onDidChangeConfig.event;

  private _disposable: vscode.Disposable;

  constructor() {
    this._disposable = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("sonicpi")) {
        this._onDidChangeConfig.fire(this.getAll());
      }
    });
  }

  private get cfg(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration("sonicpi");
  }

  get host(): string {
    return this.cfg.get<string>("osc.host", "127.0.0.1");
  }

  get sendPort(): number {
    return this.clampPort(this.cfg.get<number>("osc.sendPort", 4557));
  }

  get listenPort(): number {
    return this.clampPort(this.cfg.get<number>("osc.listenPort", 4558));
  }

  get daemonPort(): number {
    return this.clampPort(this.cfg.get<number>("osc.daemonPort", 0), true);
  }

  get autoConnect(): boolean {
    return this.cfg.get<boolean>("autoConnect", true);
  }

  get heartbeatInterval(): number {
    const val = this.cfg.get<number>("heartbeatInterval", 2000);
    return Math.max(500, Math.min(10000, val));
  }

  get sonicPiPath(): string {
    return this.cfg.get<string>("sonicPiPath", "");
  }

  get audioInputs(): boolean {
    return this.cfg.get<boolean>("audioInputs", false);
  }

  get logLevel(): LogLevel {
    const val = this.cfg.get<string>("logLevel", "info");
    const valid: LogLevel[] = ["debug", "info", "warning", "error"];
    return valid.includes(val as LogLevel) ? (val as LogLevel) : "info";
  }

  getAll(): SonicPiConfig {
    return {
      osc: {
        host: this.host,
        sendPort: this.sendPort,
        listenPort: this.listenPort,
        daemonPort: this.daemonPort,
      },
      autoConnect: this.autoConnect,
      heartbeatInterval: this.heartbeatInterval,
      sonicPiPath: this.sonicPiPath,
      audioInputs: this.audioInputs,
      logLevel: this.logLevel,
    };
  }

  private clampPort(port: number, allowZero = false): number {
    const min = allowZero ? 0 : 1;
    return Math.max(min, Math.min(65535, Math.floor(port)));
  }

  dispose(): void {
    this._onDidChangeConfig.dispose();
    this._disposable.dispose();
  }
}
