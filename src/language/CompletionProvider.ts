import * as vscode from "vscode";
import type { SonicPiData } from "../types/sonicpi.js";

export class CompletionProvider implements vscode.CompletionItemProvider {
  constructor(private readonly _data: SonicPiData) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext
  ): vscode.CompletionItem[] {
    const lineText = document.lineAt(position).text;
    const textBefore = lineText.substring(0, position.character);

    if (this.isAfterSynthContext(textBefore)) {
      return this.synthCompletions();
    }

    if (this.isAfterSampleContext(textBefore)) {
      return this.sampleCompletions();
    }

    if (this.isAfterFxContext(textBefore)) {
      return this.fxCompletions();
    }

    if (this.isAfterScaleContext(textBefore)) {
      return this.scaleCompletions();
    }

    if (this.isAfterChordContext(textBefore)) {
      return this.chordCompletions();
    }

    if (this.isAfterNoteContext(textBefore)) {
      return this.noteCompletions();
    }

    if (this.isAfterOptContext(textBefore)) {
      return this.optCompletions(textBefore);
    }

    return this.functionCompletions();
  }

  private isAfterSynthContext(text: string): boolean {
    return /(?:use_synth|with_synth|synth)\s+:?\s*$/.test(text);
  }

  private isAfterSampleContext(text: string): boolean {
    return /sample\s+:?\s*$/.test(text);
  }

  private isAfterFxContext(text: string): boolean {
    return /(?:use_fx|with_fx)\s+:?\s*$/.test(text);
  }

  private isAfterScaleContext(text: string): boolean {
    return /scale\s+:\w+\s*,\s*:?\s*$/.test(text);
  }

  private isAfterChordContext(text: string): boolean {
    return /chord\s+:\w+\s*,\s*:?\s*$/.test(text);
  }

  private isAfterNoteContext(text: string): boolean {
    return /play\s+:?\s*$/.test(text);
  }

  private isAfterOptContext(text: string): boolean {
    return /,\s*$/.test(text) || /\w+\s+:[^\s]+\s*,?\s*$/.test(text);
  }

  private synthCompletions(): vscode.CompletionItem[] {
    return this._data.synths.map((synth) => {
      const item = new vscode.CompletionItem(
        `:${synth.key}`,
        vscode.CompletionItemKind.Constant
      );
      item.detail = synth.name;
      item.documentation = new vscode.MarkdownString(synth.doc);
      item.insertText = `:${synth.key}`;
      return item;
    });
  }

  private sampleCompletions(): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];
    for (const [group, samples] of Object.entries(this._data.samples)) {
      for (const sample of samples) {
        const item = new vscode.CompletionItem(
          `:${sample.name}`,
          vscode.CompletionItemKind.Constant
        );
        item.detail = group;
        item.insertText = `:${sample.name}`;
        items.push(item);
      }
    }
    return items;
  }

  private fxCompletions(): vscode.CompletionItem[] {
    return this._data.fx.map((fx) => {
      const item = new vscode.CompletionItem(
        `:${fx.key}`,
        vscode.CompletionItemKind.Constant
      );
      item.detail = fx.name;
      item.documentation = new vscode.MarkdownString(fx.doc);
      item.insertText = `:${fx.key}`;
      return item;
    });
  }

  private optCompletions(textBefore: string): vscode.CompletionItem[] {
    const allOpts = new Map<string, string>();

    const synthMatch = textBefore.match(
      /(?:use_synth|with_synth|synth)\s+:(\w+)/
    );
    if (synthMatch) {
      const synth = this._data.synths.find((s) => s.key === synthMatch[1]);
      if (synth) {
        for (const [name, info] of Object.entries(synth.opts)) {
          allOpts.set(name, info.doc);
        }
      }
    }

    const fxMatch = textBefore.match(/(?:use_fx|with_fx)\s+:(\w+)/);
    if (fxMatch) {
      const fx = this._data.fx.find((f) => f.key === fxMatch[1]);
      if (fx) {
        for (const [name, info] of Object.entries(fx.opts)) {
          allOpts.set(name, info.doc);
        }
      }
    }

    if (allOpts.size === 0) {
      const commonOpts = [
        "amp", "pan", "attack", "decay", "sustain", "release",
        "note", "cutoff", "res", "rate", "mix", "phase",
      ];
      for (const opt of commonOpts) {
        allOpts.set(opt, "");
      }
    }

    return Array.from(allOpts.entries()).map(([name, doc]) => {
      const item = new vscode.CompletionItem(
        `${name}:`,
        vscode.CompletionItemKind.Property
      );
      item.detail = "option";
      if (doc) {
        item.documentation = new vscode.MarkdownString(doc);
      }
      item.insertText = new vscode.SnippetString(`${name}: \${1}`);
      return item;
    });
  }

  private scaleCompletions(): vscode.CompletionItem[] {
    return (this._data.scales ?? []).map((scale) => {
      const item = new vscode.CompletionItem(
        `:${scale.name}`,
        vscode.CompletionItemKind.EnumMember
      );
      item.detail = "scale";
      if (scale.intervals.length > 0) {
        item.documentation = new vscode.MarkdownString(
          `Intervals: \`[${scale.intervals.join(", ")}]\``
        );
      }
      item.insertText = `:${scale.name}`;
      return item;
    });
  }

  private chordCompletions(): vscode.CompletionItem[] {
    return (this._data.chords ?? []).map((chord) => {
      const item = new vscode.CompletionItem(
        `:${chord.name}`,
        vscode.CompletionItemKind.EnumMember
      );
      item.detail = "chord";
      item.documentation = new vscode.MarkdownString(
        `Intervals: \`[${chord.intervals.join(", ")}]\``
      );
      item.insertText = `:${chord.name}`;
      return item;
    });
  }

  private noteCompletions(): vscode.CompletionItem[] {
    const notes = this._data.notes ?? {};
    return Object.entries(notes).map(([name, midi]) => {
      const item = new vscode.CompletionItem(
        `:${name}`,
        vscode.CompletionItemKind.Value
      );
      item.detail = `MIDI ${midi}`;
      item.insertText = `:${name}`;
      item.sortText = String(midi).padStart(3, "0");
      return item;
    });
  }

  private functionCompletions(): vscode.CompletionItem[] {
    return this._data.functions.map((fn) => {
      const item = new vscode.CompletionItem(
        fn.name,
        vscode.CompletionItemKind.Function
      );
      item.detail = `[${fn.category}]`;
      item.documentation = new vscode.MarkdownString(fn.doc);
      return item;
    });
  }
}
