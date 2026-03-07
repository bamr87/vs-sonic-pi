import * as vscode from "vscode";
import { join } from "path";
import { ConfigManager } from "./config/ConfigManager.js";
import { ConnectionManager } from "./connection/ConnectionManager.js";
import { PortDiscovery } from "./connection/PortDiscovery.js";
import { DaemonSpawner } from "./connection/DaemonSpawner.js";
import { CommandHandler } from "./commands/index.js";
import { LogManager } from "./log/LogManager.js";
import { StatusBarManager } from "./ui/StatusBarManager.js";
import { CompletionProvider } from "./language/CompletionProvider.js";
import { HoverProvider } from "./language/HoverProvider.js";
import { DiagnosticsProvider } from "./language/DiagnosticsProvider.js";
import { TutorialTreeProvider } from "./ui/TutorialTreeProvider.js";
import { TutorialWebview } from "./ui/TutorialWebview.js";
import { ControlsTreeProvider } from "./ui/ControlsTreeProvider.js";
import { ExamplesTreeProvider } from "./ui/ExamplesTreeProvider.js";
import { ReferenceWebview } from "./ui/ReferenceWebview.js";
import type { SonicPiData } from "./types/sonicpi.js";
import sonicPiDataJson from "./data/sonic-pi-data.json";

let connectionManager: ConnectionManager | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const config = new ConfigManager();
  context.subscriptions.push(config);

  const portDiscovery = new PortDiscovery({
    configSendPort: config.sendPort,
    configListenPort: config.listenPort,
    configDaemonPort: config.daemonPort,
  });

  const daemonSpawner = new DaemonSpawner(
    config.sonicPiPath || undefined
  );
  context.subscriptions.push(daemonSpawner);

  connectionManager = new ConnectionManager(
    config,
    portDiscovery,
    daemonSpawner
  );
  context.subscriptions.push(connectionManager);

  const logManager = new LogManager();
  logManager.logLevel = config.logLevel;
  context.subscriptions.push(logManager);

  const diagnosticsProvider = new DiagnosticsProvider();
  context.subscriptions.push(diagnosticsProvider);

  connectionManager.onDidReceiveMessage((msg) => {
    logManager.handleMessage(msg);
    diagnosticsProvider.handleMessage(msg);
  });

  const commandHandler = new CommandHandler(
    connectionManager,
    context.extensionPath
  );
  commandHandler.registerAll(context);
  context.subscriptions.push(commandHandler);

  const statusBar = new StatusBarManager(connectionManager);
  context.subscriptions.push(statusBar);

  const controlsTree = new ControlsTreeProvider(connectionManager);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("sonicpi.controlsTree", controlsTree)
  );

  const examplesPath = join(context.extensionPath, "examples");
  const examplesTree = new ExamplesTreeProvider(examplesPath);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("sonicpi.examplesTree", examplesTree)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "sonicpi.openExampleFile",
      async (filePath: string) => {
        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc);
      }
    )
  );

  const tutorialPath = join(context.extensionPath, "media", "tutorial");
  const tutorialTree = new TutorialTreeProvider(tutorialPath);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("sonicpi.tutorialTree", tutorialTree)
  );

  const tutorialWebview = new TutorialWebview(context.extensionPath);
  context.subscriptions.push(
    vscode.commands.registerCommand("sonicpi.openTutorial", () => {
      tutorialWebview.openChapter("01-Welcome-to-Sonic-Pi.md");
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "sonicpi.openTutorialChapter",
      (filename: string) => {
        tutorialWebview.openChapter(filename);
      }
    )
  );

  const sonicPiData = sonicPiDataJson as unknown as SonicPiData;

  const referenceWebview = new ReferenceWebview(sonicPiData);
  context.subscriptions.push(
    vscode.commands.registerCommand("sonicpi.openReference", () => {
      referenceWebview.open();
    })
  );

  const selector: vscode.DocumentSelector = { language: "sonicpi" };

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      selector,
      new CompletionProvider(sonicPiData),
      ":",
      ","
    )
  );

  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      selector,
      new HoverProvider(sonicPiData)
    )
  );

  config.onDidChangeConfig((cfg) => {
    logManager.logLevel = cfg.logLevel;
  });

  connectionManager.onDidChangeState((state) => {
    if (state === "connected") {
      logManager.show();
    }
  });

  if (config.autoConnect) {
    connectionManager.connect();
  }

  console.log("Sonic Pi extension activated");
}

export function deactivate(): void {
  connectionManager = undefined;
  console.log("Sonic Pi extension deactivated");
}
