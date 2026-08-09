import * as vscode from "vscode";

export interface LiveLoopBlock {
  name: string;
  startLine: number;
  /** Inclusive line of the matching `end`, or the last line if unclosed. */
  endLine: number;
}

const LIVE_LOOP_RE = /^\s*live_loop\s+:([A-Za-z_]\w*)/;
const BLOCK_KEYWORD_RE = /^\s*(?:if|unless|while|until|case|begin|def|module|class)\b/;

function strippedOfCommentsAndStrings(line: string): string {
  return line
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/#.*$/, "");
}

function depthDelta(line: string): number {
  const code = strippedOfCommentsAndStrings(line);
  let delta = 0;
  delta += (code.match(/\bdo\b/g) ?? []).length;
  if (BLOCK_KEYWORD_RE.test(code)) delta += 1;
  delta -= (code.match(/\bend\b/g) ?? []).length;
  return delta;
}

/**
 * Locate every top-level `live_loop :name do ... end` block by tracking
 * do/end nesting. Heuristic (strings/comments are stripped line-wise), which
 * is plenty for well-formed buffers; unclosed loops extend to the last line.
 */
export function findLiveLoops(text: string): LiveLoopBlock[] {
  const lines = text.split("\n");
  const blocks: LiveLoopBlock[] = [];

  let current: { name: string; startLine: number; depth: number } | undefined;

  for (let i = 0; i < lines.length; i++) {
    if (!current) {
      const match = LIVE_LOOP_RE.exec(lines[i]);
      if (match) {
        const depth = depthDelta(lines[i]);
        if (depth <= 0) {
          // single-line block (or malformed); treat as one line
          blocks.push({ name: match[1], startLine: i, endLine: i });
        } else {
          current = { name: match[1], startLine: i, depth };
        }
      }
      continue;
    }

    current.depth += depthDelta(lines[i]);
    if (current.depth <= 0) {
      blocks.push({
        name: current.name,
        startLine: current.startLine,
        endLine: i,
      });
      current = undefined;
    }
  }

  if (current) {
    blocks.push({
      name: current.name,
      startLine: current.startLine,
      endLine: lines.length - 1,
    });
  }

  return blocks;
}

export class LiveLoopLensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.CodeLens[] {
    return findLiveLoops(document.getText()).map((block) => {
      const range = new vscode.Range(block.startLine, 0, block.startLine, 0);
      return new vscode.CodeLens(range, {
        title: `$(play) Run loop :${block.name}`,
        tooltip: `Send live_loop :${block.name} to Sonic Pi`,
        command: "sonicpi.runLiveLoop",
        arguments: [document.uri, block.startLine, block.endLine],
      });
    });
  }
}
