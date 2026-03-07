export class EventEmitter {
  private _listeners: Array<(...args: any[]) => void> = [];

  event = (listener: (...args: any[]) => void) => {
    this._listeners.push(listener);
    return { dispose: () => this._listeners.splice(this._listeners.indexOf(listener), 1) };
  };

  fire(data: any) {
    for (const listener of this._listeners) {
      listener(data);
    }
  }

  dispose() {
    this._listeners = [];
  }
}

export class Disposable {
  constructor(private _callOnDispose: () => void) {}
  dispose() {
    this._callOnDispose();
  }
}

export const workspace = {
  getConfiguration: (_section?: string) => ({
    get: <T>(key: string, defaultValue: T): T => defaultValue,
  }),
  onDidChangeConfiguration: () => ({ dispose: () => {} }),
};

export const window = {
  showErrorMessage: (..._args: any[]) => Promise.resolve(undefined),
  showWarningMessage: (..._args: any[]) => Promise.resolve(undefined),
  showInformationMessage: (..._args: any[]) => Promise.resolve(undefined),
  createOutputChannel: (_name: string) => ({
    appendLine: () => {},
    append: () => {},
    show: () => {},
    clear: () => {},
    dispose: () => {},
  }),
};

export const commands = {
  executeCommand: (..._args: any[]) => Promise.resolve(),
  registerCommand: (_command: string, _callback: (...args: any[]) => any) => ({
    dispose: () => {},
  }),
};

export const languages = {
  registerCompletionItemProvider: () => ({ dispose: () => {} }),
  registerHoverProvider: () => ({ dispose: () => {} }),
  createDiagnosticCollection: () => ({
    set: () => {},
    delete: () => {},
    clear: () => {},
    dispose: () => {},
  }),
};

export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

export const StatusBarItem = {};

export enum DiagnosticSeverity {
  Error = 0,
  Warning = 1,
  Information = 2,
  Hint = 3,
}

export class Range {
  constructor(
    public startLine: number,
    public startCharacter: number,
    public endLine: number,
    public endCharacter: number
  ) {}
}

export class Position {
  constructor(public line: number, public character: number) {}
}

export class Diagnostic {
  constructor(
    public range: Range,
    public message: string,
    public severity?: DiagnosticSeverity
  ) {}
}

export class Uri {
  static file(path: string) {
    return { fsPath: path, scheme: "file", path };
  }
}

export class CompletionItem {
  constructor(public label: string, public kind?: number) {}
  detail?: string;
  documentation?: any;
  insertText?: string;
}

export enum CompletionItemKind {
  Text = 0,
  Method = 1,
  Function = 2,
  Constructor = 3,
  Field = 4,
  Variable = 5,
  Class = 6,
  Interface = 7,
  Module = 8,
  Property = 9,
  Unit = 10,
  Value = 11,
  Enum = 12,
  Keyword = 13,
  Snippet = 14,
  Color = 15,
  File = 16,
  Reference = 17,
  Folder = 18,
  EnumMember = 19,
  Constant = 20,
}

export class Hover {
  constructor(public contents: any) {}
}

export class MarkdownString {
  value: string;
  isTrusted?: boolean;
  constructor(value?: string) {
    this.value = value || "";
  }
  appendMarkdown(value: string) {
    this.value += value;
    return this;
  }
  appendCodeblock(code: string, language?: string) {
    this.value += `\n\`\`\`${language || ""}\n${code}\n\`\`\`\n`;
    return this;
  }
}
