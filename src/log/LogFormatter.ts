import { LogLevel } from "../types/sonicpi.js";

export const LOG_PREFIXES: Record<number, string> = {
  0: "=>",
  1: " ",
  2: "[cue]",
  3: "[sync]",
  4: "[!]",
  5: "[error]",
  6: "[debug]",
};

/**
 * A /log/multi_message envelope mixes message types; each entry is filtered
 * against the configured log level individually so errors and warnings
 * survive even when info output is suppressed.
 */
export const MESSAGE_TYPE_LEVELS: Record<number, LogLevel> = {
  0: "info",
  1: "info",
  2: "info",
  3: "info",
  4: "warning",
  5: "error",
  6: "debug",
};

export function levelForMessageType(type: number): LogLevel {
  return MESSAGE_TYPE_LEVELS[type] ?? "info";
}

export function formatTimestamp(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `[${h}:${m}:${s}]`;
}

export function formatMultiMessage(
  threadName: string,
  runtime: string,
  messages: Array<{ type: number; content: string }>
): string {
  const ts = formatTimestamp();
  const header = `${ts} [${threadName} - ${runtime}]`;
  const lines = messages.map((msg) => {
    const prefix = LOG_PREFIXES[msg.type] ?? "=>";
    return ` ${prefix} ${msg.content}`;
  });
  return `${header}\n${lines.join("\n")}`;
}

export function formatInfo(message: string): string {
  return `${formatTimestamp()} [info] ${message}`;
}

export function formatError(
  description: string,
  backtrace: string,
  line: number
): string {
  const ts = formatTimestamp();
  const bt = backtrace ? `\n  Backtrace:\n    ${backtrace}` : "";
  return `${ts} [ERROR] ${description} (line ${line})${bt}`;
}

export function formatSyntaxError(
  description: string,
  errorLine: string,
  line: number
): string {
  const ts = formatTimestamp();
  return `${ts} [SYNTAX ERROR] Line ${line}: ${description}\n  ${errorLine}`;
}
