import * as vscode from "vscode";
import { join } from "path";
import { ConfigManager } from "./config/ConfigManager.js";
import { detectEnvironment } from "./config/environment.js";
import { ConnectionManager } from "./connection/ConnectionManager.js";
import { PortDiscovery } from "./connection/PortDiscovery.js";
import { DaemonSpawner } from "./connection/DaemonSpawner.js";
import { CommandHandler } from "./commands/index.js";
import { LogManager } from "./log/LogManager.js";
import { StatusBarManager } from "./ui/StatusBarManager.js";
import { AudioStreamWebview } from "./ui/AudioStreamWebview.js";
import { CompletionProvider } from "./language/CompletionProvider.js";
import { HoverProvider } from "./language/HoverProvider.js";
import { DiagnosticsProvider } from "./language/DiagnosticsProvider.js";
import { LiveLoopLensProvider } from "./language/LiveLoopLens.js";
import { TutorialTreeProvider } from "./ui/TutorialTreeProvider.js";
import { TutorialWebview } from "./ui/TutorialWebview.js";
import { ControlsTreeProvider } from "./ui/ControlsTreeProvider.js";
import { ExamplesTreeProvider } from "./ui/ExamplesTreeProvider.js";
import { ReferenceWebview } from "./ui/ReferenceWebview.js";
import type { SonicPiData } from "./types/sonicpi.js";
import sonicPiDataJson from "./data/sonic-pi-data.json";

let connectionManager: ConnectionManager | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const env = detectEnvironment();
  const config = new ConfigManager();
  context.subscriptions.push(config);

  const sonicPiPath = config.sonicPiPath || env.sonicPiHome || undefined;

  const portDiscovery = new PortDiscovery({
    configSendPort: config.sendPort,
    configListenPort: config.listenPort,
    configDaemonPort: config.daemonPort,
  });

  const daemonSpawner = new DaemonSpawner(sonicPiPath, {
    audioInputs: config.audioInputs,
  });
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

    // The daemon reports which audio devices scsynth opened. Surface the
    // output device: scsynth keeps the device that was the system default
    // at boot, so sound can silently go to a speakerless monitor.
    if (msg.address === "/scsynth/info") {
      const info = String(msg.args[0] ?? "");
      const out = info
        .split("\n")
        .find((line) => line.startsWith("Out"));
      if (out) {
        vscode.window
          .showInformationMessage(
            `Sonic Pi audio — ${out}. Wrong device? Change the system ` +
              `output, then restart the daemon.`,
            "Restart Daemon"
          )
          .then((choice) => {
            if (choice === "Restart Daemon") {
              vscode.commands.executeCommand("sonicpi.restartDaemon");
            }
          });
      }
    }
  });

  const commandHandler = new CommandHandler(
    connectionManager,
    diagnosticsProvider,
    logManager
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

  const audioStreamWebview = new AudioStreamWebview(env.audioStreamPort);
  context.subscriptions.push(audioStreamWebview);
  context.subscriptions.push(
    vscode.commands.registerCommand("sonicpi.openAudioStream", () => {
      audioStreamWebview.open();
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

  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      selector,
      new LiveLoopLensProvider()
    )
  );

  config.onDidChangeConfig((cfg) => {
    logManager.logLevel = cfg.logLevel;
  });

  let codespaceNotified = false;
  connectionManager.onDidChangeState((state) => {
    if (state === "connected") {
      logManager.show();

      if (env.isCodespace && !codespaceNotified) {
        codespaceNotified = true;
        vscode.window
          .showInformationMessage(
            "Sonic Pi connected in Codespace. Open the audio stream to hear output.",
            "Listen"
          )
          .then((choice) => {
            if (choice === "Listen") {
              vscode.commands.executeCommand("sonicpi.openAudioStream");
            }
          });
      }
    }
  });

  if (config.autoConnect) {
    // Quiet: don't pop an error on activation when Sonic Pi isn't running;
    // the status bar shows the state and a click retries loudly.
    connectionManager.connect({ quiet: true });
  }

  console.log("Sonic Pi extension activated");
}

export function deactivate(): void {
  connectionManager = undefined;
  console.log("Sonic Pi extension deactivated");
}
