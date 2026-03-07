import * as vscode from "vscode";
import { readdirSync } from "fs";
import { join, basename } from "path";

type ExampleNode = CategoryNode | FileNode;

interface CategoryNode {
  type: "category";
  label: string;
  dirPath: string;
}

interface FileNode {
  type: "file";
  label: string;
  filePath: string;
  category: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  apprentice: "mortar-board",
  illusionist: "sparkle",
  magician: "wand",
  wizard: "star-full",
  sorcerer: "flame",
  algomancer: "circuit-board",
  incubation: "beaker",
  retro_arcade: "game",
  classical_arabic: "globe",
};

export class ExamplesTreeProvider
  implements vscode.TreeDataProvider<ExampleNode>
{
  private readonly _onDidChangeTreeData =
    new vscode.EventEmitter<ExampleNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly _examplesPath: string) {}

  getTreeItem(element: ExampleNode): vscode.TreeItem {
    if (element.type === "category") {
      const item = new vscode.TreeItem(
        this.formatCategoryName(element.label),
        vscode.TreeItemCollapsibleState.Collapsed
      );
      item.iconPath = new vscode.ThemeIcon(
        CATEGORY_ICONS[element.label] || "folder"
      );
      const count = this.countFiles(element.dirPath);
      item.description = `${count} example${count !== 1 ? "s" : ""}`;
      return item;
    }

    const item = new vscode.TreeItem(element.label);
    item.iconPath = new vscode.ThemeIcon("file-code");
    item.command = {
      command: "sonicpi.openExampleFile",
      title: "Open Example",
      arguments: [element.filePath],
    };
    item.tooltip = `Open ${element.label}`;
    item.description = element.category;
    return item;
  }

  getChildren(element?: ExampleNode): ExampleNode[] {
    if (!element) {
      return this.getCategories();
    }
    if (element.type === "category") {
      return this.getFiles(element);
    }
    return [];
  }

  private getCategories(): CategoryNode[] {
    try {
      return readdirSync(this._examplesPath, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .sort((a, b) => {
          const order = [
            "apprentice", "illusionist", "magician", "wizard",
            "sorcerer", "algomancer", "incubation", "retro_arcade",
            "classical_arabic",
          ];
          const ai = order.indexOf(a.name);
          const bi = order.indexOf(b.name);
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        })
        .map((d) => ({
          type: "category" as const,
          label: d.name,
          dirPath: join(this._examplesPath, d.name),
        }));
    } catch {
      return [];
    }
  }

  private getFiles(category: CategoryNode): FileNode[] {
    try {
      return readdirSync(category.dirPath)
        .filter((f) => f.endsWith(".spi"))
        .sort()
        .map((f) => ({
          type: "file" as const,
          label: basename(f, ".spi").replace(/_/g, " "),
          filePath: join(category.dirPath, f),
          category: this.formatCategoryName(category.label),
        }));
    } catch {
      return [];
    }
  }

  private countFiles(dirPath: string): number {
    try {
      return readdirSync(dirPath).filter((f) => f.endsWith(".spi")).length;
    } catch {
      return 0;
    }
  }

  private formatCategoryName(name: string): string {
    return name
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
}
