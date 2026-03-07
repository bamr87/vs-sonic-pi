import * as vscode from "vscode";
import { ConnectionState } from "../types/sonicpi.js";
import { ConnectionManager } from "../connection/ConnectionManager.js";

interface ControlItem {
  id: string;
  label: string;
  icon: string;
  command: string;
  group: string;
  description?: string;
  connectedOnly?: boolean;
}

const CONTROLS: ControlItem[] = [
  {
    id: "connect",
    label: "Connect",
    icon: "plug",
    command: "sonicpi.connect",
    group: "Connection",
  },
  {
    id: "disconnect",
    label: "Disconnect",
    icon: "debug-disconnect",
    command: "sonicpi.disconnect",
    group: "Connection",
    connectedOnly: true,
  },
  {
    id: "run",
    label: "Run",
    icon: "play",
    command: "sonicpi.run",
    group: "Playback",
    description: "F5",
  },
  {
    id: "runSelection",
    label: "Run Selection",
    icon: "play-circle",
    command: "sonicpi.runSelection",
    group: "Playback",
    description: "Ctrl+F5",
  },
  {
    id: "stop",
    label: "Stop",
    icon: "debug-stop",
    command: "sonicpi.stop",
    group: "Playback",
    description: "Shift+F5",
  },
  {
    id: "startRecording",
    label: "Start Recording",
    icon: "circle-filled",
    command: "sonicpi.startRecording",
    group: "Recording",
    connectedOnly: true,
  },
  {
    id: "stopRecording",
    label: "Stop Recording",
    icon: "primitive-square",
    command: "sonicpi.stopRecording",
    group: "Recording",
    connectedOnly: true,
  },
  {
    id: "saveRecording",
    label: "Save Recording",
    icon: "save",
    command: "sonicpi.saveRecording",
    group: "Recording",
    connectedOnly: true,
  },
  {
    id: "beautify",
    label: "Beautify Buffer",
    icon: "wand",
    command: "sonicpi.beautify",
    group: "Tools",
    connectedOnly: true,
  },
  {
    id: "openExamples",
    label: "Open Examples",
    icon: "file-code",
    command: "sonicpi.openExamples",
    group: "Resources",
  },
  {
    id: "openTutorial",
    label: "Open Tutorial",
    icon: "book",
    command: "sonicpi.openTutorial",
    group: "Resources",
  },
  {
    id: "openReference",
    label: "Language Reference",
    icon: "references",
    command: "sonicpi.openReference",
    group: "Resources",
  },
];

type TreeNode = GroupNode | ActionNode;

interface GroupNode {
  type: "group";
  label: string;
  children: ActionNode[];
}

interface ActionNode {
  type: "action";
  control: ControlItem;
}

export class ControlsTreeProvider
  implements vscode.TreeDataProvider<TreeNode>
{
  private readonly _onDidChangeTreeData =
    new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _connectionState = ConnectionState.Disconnected;

  constructor(connectionManager: ConnectionManager) {
    this._connectionState = connectionManager.state;
    connectionManager.onDidChangeState((state) => {
      this._connectionState = state;
      this._onDidChangeTreeData.fire(undefined);
    });
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    if (element.type === "group") {
      const item = new vscode.TreeItem(
        element.label,
        vscode.TreeItemCollapsibleState.Expanded
      );
      item.iconPath = this.groupIcon(element.label);
      return item;
    }

    const ctrl = element.control;
    const connected = this._connectionState === ConnectionState.Connected;
    const disabled = ctrl.connectedOnly && !connected;

    const item = new vscode.TreeItem(ctrl.label);
    item.iconPath = new vscode.ThemeIcon(
      ctrl.icon,
      disabled
        ? new vscode.ThemeColor("disabledForeground")
        : undefined
    );

    if (ctrl.description) {
      item.description = ctrl.description;
    }

    if (!disabled) {
      item.command = {
        command: ctrl.command,
        title: ctrl.label,
      };
    } else {
      item.tooltip = "Connect to Sonic Pi first";
    }

    if (ctrl.id === "connect") {
      if (connected) {
        item.description = "Connected";
        item.iconPath = new vscode.ThemeIcon(
          "check",
          new vscode.ThemeColor("testing.iconPassed")
        );
      } else if (this._connectionState === ConnectionState.Connecting) {
        item.description = "Connecting...";
        item.iconPath = new vscode.ThemeIcon("loading~spin");
      }
    }

    if (ctrl.id === "disconnect" && !connected) {
      return new vscode.TreeItem("");
    }

    return item;
  }

  getChildren(element?: TreeNode): TreeNode[] {
    if (!element) {
      return this.buildGroups();
    }
    if (element.type === "group") {
      return element.children;
    }
    return [];
  }

  private buildGroups(): GroupNode[] {
    const groupMap = new Map<string, ActionNode[]>();
    const connected = this._connectionState === ConnectionState.Connected;

    for (const ctrl of CONTROLS) {
      if (ctrl.id === "disconnect" && !connected) continue;
      if (ctrl.id === "connect" && connected) continue;

      if (!groupMap.has(ctrl.group)) {
        groupMap.set(ctrl.group, []);
      }
      groupMap.get(ctrl.group)!.push({ type: "action", control: ctrl });
    }

    return Array.from(groupMap.entries()).map(([label, children]) => ({
      type: "group" as const,
      label,
      children,
    }));
  }

  private groupIcon(label: string): vscode.ThemeIcon {
    const icons: Record<string, string> = {
      Connection: "plug",
      Playback: "play",
      Recording: "record",
      Tools: "tools",
      Resources: "library",
    };
    return new vscode.ThemeIcon(icons[label] || "folder");
  }
}
