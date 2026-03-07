import * as vscode from "vscode";
import { readdirSync } from "fs";
import { basename } from "path";

interface TutorialChapter {
  id: string;
  title: string;
  filename: string;
  children?: TutorialChapter[];
}

const SECTION_TITLES: Record<string, string> = {
  "01": "Welcome to Sonic Pi",
  "02": "Synths",
  "03": "Samples",
  "04": "Randomisation",
  "05": "Programming Structures",
  "06": "FX",
  "07": "Control",
  "08": "Data Structures",
  "09": "Live Coding",
  "10": "State",
  "11": "MIDI",
  "12": "OSC",
  "13": "Multichannel Audio",
  "99": "Conclusions",
  A: "Articles",
  B: "Essential Knowledge",
};

export class TutorialTreeProvider
  implements vscode.TreeDataProvider<TutorialChapter>
{
  private _chapters: TutorialChapter[] = [];
  private readonly _onDidChangeTreeData =
    new vscode.EventEmitter<TutorialChapter | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly _tutorialPath: string) {
    this._chapters = this.buildTree();
  }

  private buildTree(): TutorialChapter[] {
    let files: string[];
    try {
      files = readdirSync(this._tutorialPath)
        .filter((f) => f.endsWith(".md"))
        .sort();
    } catch {
      return [];
    }

    const sections = new Map<string, TutorialChapter>();
    const topLevel: TutorialChapter[] = [];

    for (const file of files) {
      const name = basename(file, ".md");
      const match = name.match(/^(\d{2}|[AB])(\.(\d+))?-(.+)$/);
      if (!match) continue;

      const sectionId = match[1];
      const subId = match[3];
      const rawTitle = match[4].replace(/-/g, " ");
      const title = subId
        ? `${sectionId}.${subId} ${rawTitle}`
        : `${sectionId} ${rawTitle}`;

      const chapter: TutorialChapter = {
        id: name,
        title,
        filename: file,
      };

      if (subId) {
        let parent = sections.get(sectionId);
        if (!parent) {
          parent = {
            id: sectionId,
            title: `${sectionId} ${SECTION_TITLES[sectionId] || rawTitle}`,
            filename: `${sectionId}-${SECTION_TITLES[sectionId]?.replace(/ /g, "-") || rawTitle}.md`,
            children: [],
          };
          sections.set(sectionId, parent);
          topLevel.push(parent);
        }
        parent.children = parent.children || [];
        parent.children.push(chapter);
      } else if (!sections.has(sectionId)) {
        chapter.children = [];
        sections.set(sectionId, chapter);
        topLevel.push(chapter);
      }
    }

    return topLevel;
  }

  getTreeItem(element: TutorialChapter): vscode.TreeItem {
    const hasChildren = element.children && element.children.length > 0;
    const item = new vscode.TreeItem(
      element.title,
      hasChildren
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );

    if (!hasChildren) {
      item.command = {
        command: "sonicpi.openTutorialChapter",
        title: "Open Chapter",
        arguments: [element.filename],
      };
    }

    item.iconPath = new vscode.ThemeIcon("book");
    return item;
  }

  getChildren(element?: TutorialChapter): TutorialChapter[] {
    if (!element) return this._chapters;
    return element.children || [];
  }
}
