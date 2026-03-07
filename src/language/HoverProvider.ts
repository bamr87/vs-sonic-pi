import * as vscode from "vscode";
import type { SonicPiData } from "../types/sonicpi.js";

export class HoverProvider implements vscode.HoverProvider {
  constructor(private readonly _data: SonicPiData) {}

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.Hover | undefined {
    const wordRange = document.getWordRangeAtPosition(
      position,
      /[a-zA-Z_][a-zA-Z0-9_!?]*/
    );
    if (!wordRange) return undefined;

    const word = document.getText(wordRange);

    const lineText = document.lineAt(position).text;
    const charBefore = wordRange.start.character > 0
      ? lineText[wordRange.start.character - 1]
      : "";

    if (charBefore === ":") {
      return this.hoverSymbol(word);
    }

    return this.hoverFunction(word);
  }

  private hoverSymbol(name: string): vscode.Hover | undefined {
    const synth = this._data.synths.find((s) => s.key === name);
    if (synth) {
      return new vscode.Hover(this.buildSynthDoc(synth));
    }

    const fx = this._data.fx.find((f) => f.key === name);
    if (fx) {
      return new vscode.Hover(this.buildFxDoc(fx));
    }

    for (const [group, samples] of Object.entries(this._data.samples)) {
      const sample = samples.find((s) => s.name === name);
      if (sample) {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**Sample: \`:${name}\`**\n\nCategory: ${group}`);
        return new vscode.Hover(md);
      }
    }

    const scale = (this._data.scales ?? []).find((s) => s.name === name);
    if (scale) {
      const md = new vscode.MarkdownString();
      md.appendMarkdown(`**Scale: \`:${scale.name}\`**\n\n`);
      if (scale.intervals.length > 0) {
        md.appendMarkdown(`Intervals: \`[${scale.intervals.join(", ")}]\``);
      } else {
        md.appendMarkdown("*Microtonal scale (Turkish makam)*");
      }
      return new vscode.Hover(md);
    }

    const chord = (this._data.chords ?? []).find((c) => c.name === name);
    if (chord) {
      const md = new vscode.MarkdownString();
      md.appendMarkdown(`**Chord: \`:${chord.name}\`**\n\n`);
      md.appendMarkdown(`Intervals: \`[${chord.intervals.join(", ")}]\``);
      return new vscode.Hover(md);
    }

    const notes = this._data.notes ?? {};
    if (notes[name] !== undefined) {
      const md = new vscode.MarkdownString();
      md.appendMarkdown(`**Note: \`:${name}\`** — MIDI ${notes[name]}`);
      return new vscode.Hover(md);
    }

    return undefined;
  }

  private hoverFunction(name: string): vscode.Hover | undefined {
    const fn = this._data.functions.find((f) => f.name === name);
    if (!fn) return undefined;

    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**\`${fn.name}\`** — *${fn.category}*`);
    if (fn.introduced) {
      md.appendMarkdown(` (since v${fn.introduced})`);
    }
    md.appendMarkdown("\n\n");

    if (fn.summary) {
      md.appendMarkdown(`${fn.summary}\n\n`);
    }

    md.appendMarkdown(fn.doc);

    if (fn.args && fn.args.length > 0) {
      md.appendMarkdown(`\n\n**Arguments:** ${fn.args.map((a) => `\`${a}\``).join(", ")}`);
    }

    if (fn.opts && Object.keys(fn.opts).length > 0) {
      md.appendMarkdown("\n\n**Options:**\n\n| Option | Description |\n|---|---|\n");
      for (const [optName, optDoc] of Object.entries(fn.opts)) {
        md.appendMarkdown(`| \`${optName}\` | ${optDoc} |\n`);
      }
    }

    if (fn.examples && fn.examples.length > 0) {
      md.appendMarkdown("\n\n**Examples:**\n");
      for (const example of fn.examples.slice(0, 3)) {
        md.appendCodeblock(example, "ruby");
      }
    }

    return new vscode.Hover(md);
  }

  private buildSynthDoc(
    synth: (typeof this._data.synths)[number]
  ): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**Synth: \`:${synth.key}\`** — ${synth.name}\n\n`);
    md.appendMarkdown(`${synth.doc}\n\n`);

    const optNames = Object.keys(synth.opts);
    if (optNames.length > 0) {
      md.appendMarkdown("**Options:**\n\n");
      md.appendMarkdown("| Option | Default | Slidable |\n|---|---|---|\n");
      for (const [name, info] of Object.entries(synth.opts)) {
        const slidable = info.slidable ? "Yes" : "No";
        md.appendMarkdown(`| \`${name}\` | ${info.default} | ${slidable} |\n`);
      }
    }

    return md;
  }

  private buildFxDoc(
    fx: (typeof this._data.fx)[number]
  ): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**FX: \`:${fx.key}\`** — ${fx.name}\n\n`);
    md.appendMarkdown(`${fx.doc}\n\n`);

    const optNames = Object.keys(fx.opts);
    if (optNames.length > 0) {
      md.appendMarkdown("**Options:**\n\n");
      md.appendMarkdown("| Option | Default | Slidable |\n|---|---|---|\n");
      for (const [name, info] of Object.entries(fx.opts)) {
        const slidable = info.slidable ? "Yes" : "No";
        md.appendMarkdown(`| \`${name}\` | ${info.default} | ${slidable} |\n`);
      }
    }

    return md;
  }
}
