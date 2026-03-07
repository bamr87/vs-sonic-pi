import * as vscode from "vscode";
import { ConnectionState } from "../types/sonicpi.js";
import { ConnectionManager } from "../connection/ConnectionManager.js";

interface StatusBarConfig {
  icon: string;
  text: string;
  tooltip: string;
  command: string;
}

const STATE_CONFIG: Record<ConnectionState, StatusBarConfig> = {
  [ConnectionState.Disconnected]: {
    icon: "$(debug-disconnect)",
    text: "Sonic Pi: Disconnected",
    tooltip: "Click to connect to Sonic Pi",
    command: "sonicpi.connect",
  },
  [ConnectionState.Connecting]: {
    icon: "$(loading~spin)",
    text: "Sonic Pi: Connecting...",
    tooltip: "Connecting to Sonic Pi...",
    command: "sonicpi.disconnect",
  },
  [ConnectionState.Connected]: {
    icon: "$(check)",
    text: "Sonic Pi: Connected",
    tooltip: "Click to disconnect from Sonic Pi",
    command: "sonicpi.disconnect",
  },
  [ConnectionState.Disconnecting]: {
    icon: "$(loading~spin)",
    text: "Sonic Pi: Disconnecting...",
    tooltip: "Disconnecting from Sonic Pi...",
    command: "sonicpi.connect",
  },
};

export class StatusBarManager implements vscode.Disposable {
  private readonly _item: vscode.StatusBarItem;
  private _disposable: vscode.Disposable;

  constructor(connectionManager: ConnectionManager) {
    this._item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );

    this.update(connectionManager.state);
    this._item.show();

    this._disposable = connectionManager.onDidChangeState((state) => {
      this.update(state);
    });
  }

  private update(state: ConnectionState): void {
    const config = STATE_CONFIG[state];
    this._item.text = `${config.icon} ${config.text}`;
    this._item.tooltip = config.tooltip;
    this._item.command = config.command;
  }

  dispose(): void {
    this._item.dispose();
    this._disposable.dispose();
  }
}
