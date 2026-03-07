import * as vscode from "vscode";
import { OscMessage } from "../types/osc.js";
import { LogLevel } from "../types/sonicpi.js";
import {
  formatMultiMessage,
  formatInfo,
  formatError,
  formatSyntaxError,
} from "./LogFormatter.js";

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warning: 2,
  error: 3,
};

export class LogManager implements vscode.Disposable {
  private readonly _channel: vscode.OutputChannel;
  private _logLevel: LogLevel = "info";
  private _disposables: vscode.Disposable[] = [];

  constructor() {
    this._channel = vscode.window.createOutputChannel("Sonic Pi Log");
  }

  set logLevel(level: LogLevel) {
    this._logLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[this._logLevel];
  }

  handleMessage(msg: OscMessage): void {
    switch (msg.address) {
      case "/log/multi_message":
        this.handleMultiMessage(msg);
        break;
      case "/log/info":
        this.handleInfo(msg);
        break;
      case "/error":
        this.handleError(msg);
        break;
      case "/syntax_error":
        this.handleSyntaxError(msg);
        break;
    }
  }

  /**
   * /log/multi_message args:
   * [job_id, thread_name, runtime, N, type1, msg1, type2, msg2, ...]
   */
  private handleMultiMessage(msg: OscMessage): void {
    if (!this.shouldLog("info")) return;

    const args = msg.args;
    const threadName = String(args[1] ?? "");
    const runtime = String(args[2] ?? "");
    const count = Number(args[3] ?? 0);

    const messages: Array<{ type: number; content: string }> = [];
    for (let i = 0; i < count; i++) {
      const type = Number(args[4 + i * 2] ?? 0);
      const content = String(args[5 + i * 2] ?? "");
      messages.push({ type, content });
    }

    const formatted = formatMultiMessage(threadName, runtime, messages);
    this._channel.appendLine(formatted);
  }

  private handleInfo(msg: OscMessage): void {
    if (!this.shouldLog("info")) return;
    const text = String(msg.args[0] ?? "");
    this._channel.appendLine(formatInfo(text));
  }

  /**
   * /error args: [job_id, desc, backtrace, line]
   */
  private handleError(msg: OscMessage): void {
    if (!this.shouldLog("error")) return;
    const description = String(msg.args[1] ?? "");
    const backtrace = String(msg.args[2] ?? "");
    const line = Number(msg.args[3] ?? 0);
    this._channel.appendLine(formatError(description, backtrace, line));
  }

  /**
   * /syntax_error args: [job_id, desc, error_line, line, line_s]
   */
  private handleSyntaxError(msg: OscMessage): void {
    if (!this.shouldLog("error")) return;
    const description = String(msg.args[1] ?? "");
    const errorLine = String(msg.args[2] ?? "");
    const line = Number(msg.args[3] ?? 0);
    this._channel.appendLine(formatSyntaxError(description, errorLine, line));
  }

  show(): void {
    this._channel.show(true);
  }

  clear(): void {
    this._channel.clear();
  }

  dispose(): void {
    for (const d of this._disposables) {
      d.dispose();
    }
    this._channel.dispose();
  }
}
