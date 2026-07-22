import * as vscode from "vscode";
import { ConnectionState, PortMap } from "../types/sonicpi.js";
import { OscMessage } from "../types/osc.js";
import { OscTransport } from "./OscTransport.js";
import { Heartbeat } from "./Heartbeat.js";
import { PortDiscovery } from "./PortDiscovery.js";
import { DaemonSpawner } from "./DaemonSpawner.js";
import { ConfigManager } from "../config/ConfigManager.js";

const MAX_PING_RETRIES = 5;
const PING_TIMEOUT_MS = 1000;

export interface ConnectOptions {
  /** Suppress error popups (used for auto-connect on activation). */
  quiet?: boolean;
}

export class ConnectionManager implements vscode.Disposable {
  private _state = ConnectionState.Disconnected;
  private _transport: OscTransport | undefined;
  private _heartbeat: Heartbeat | undefined;
  private _portMap: PortMap | undefined;
  private _messageDisposables: vscode.Disposable[] = [];

  private readonly _onDidChangeState =
    new vscode.EventEmitter<ConnectionState>();
  readonly onDidChangeState = this._onDidChangeState.event;

  private readonly _onDidReceiveMessage = new vscode.EventEmitter<OscMessage>();
  readonly onDidReceiveMessage = this._onDidReceiveMessage.event;

  constructor(
    private readonly _config: ConfigManager,
    private readonly _portDiscovery: PortDiscovery,
    private readonly _daemonSpawner: DaemonSpawner
  ) {}

  get state(): ConnectionState {
    return this._state;
  }

  get transport(): OscTransport | undefined {
    return this._transport;
  }

  get portMap(): PortMap | undefined {
    return this._portMap;
  }

  get isConnected(): boolean {
    return this._state === ConnectionState.Connected;
  }

  private setState(state: ConnectionState): void {
    if (this._state === state) return;
    this._state = state;
    vscode.commands.executeCommand(
      "setContext",
      "sonicpi.connected",
      state === ConnectionState.Connected
    );
    this._onDidChangeState.fire(state);
  }

  private teardownTransport(): Promise<void> {
    for (const d of this._messageDisposables) {
      d.dispose();
    }
    this._messageDisposables = [];

    const transport = this._transport;
    this._transport = undefined;
    this._portMap = undefined;

    return transport ? transport.dispose() : Promise.resolve();
  }

  private async connectWithPorts(ports: PortMap): Promise<boolean> {
    this._portMap = ports;

    this._transport = new OscTransport({
      host: this._config.host,
      sendPort: ports.guiSendToServer,
      listenPort: ports.guiListenToServer,
      token: ports.token,
    });

    await this._transport.open();

    this._messageDisposables.push(
      this._transport.onAnyMessage((msg) => {
        this._onDidReceiveMessage.fire(msg);
      })
    );

    this._messageDisposables.push(
      this._transport.onMessage("/exited", () => {
        this.disconnect();
      })
    );

    this._messageDisposables.push(
      this._transport.onMessage("/exited-with-boot-error", () => {
        vscode.window.showErrorMessage(
          "Sonic Pi exited with a boot error. Check the Sonic Pi log for details."
        );
        this.disconnect();
      })
    );

    const ackReceived = await this.pingWithRetry();

    if (!ackReceived) {
      await this.teardownTransport();
      return false;
    }

    if (ports.daemon > 0) {
      this._heartbeat = new Heartbeat(
        this._config.host,
        ports.daemon,
        ports.token,
        this._config.heartbeatInterval
      );
      this._heartbeat.start();
    }

    return true;
  }

  async connect(options: ConnectOptions = {}): Promise<void> {
    if (
      this._state === ConnectionState.Connected ||
      this._state === ConnectionState.Connecting
    ) {
      return;
    }

    this.setState(ConnectionState.Connecting);

    try {
      let ports: PortMap;
      let triedPortFile = false;

      // Check if an existing daemon left a port-info file
      const existingPorts = this._portDiscovery.discoverFromPortFile();

      if (existingPorts) {
        ports = existingPorts;
        triedPortFile = true;
      } else if (this._daemonSpawner.findDaemonPath() && !this._daemonSpawner.isRunning) {
        try {
          ports = await this._daemonSpawner.spawn();
        } catch {
          ports = this._portDiscovery.discover();
        }
      } else {
        ports = this._portDiscovery.discover();
      }

      let connected = await this.connectWithPorts(ports);

      // If persisted ports are stale, clear file and retry with fresh discovery/spawn.
      if (!connected && triedPortFile) {
        this._portDiscovery.clearDiscoveredPortInfo();

        if (this._daemonSpawner.findDaemonPath() && !this._daemonSpawner.isRunning) {
          try {
            ports = await this._daemonSpawner.spawn();
          } catch {
            ports = this._portDiscovery.discoverFromConfigAndDefaults();
          }
        } else {
          ports = this._portDiscovery.discoverFromConfigAndDefaults();
        }

        connected = await this.connectWithPorts(ports);
      }

      if (!connected) {
        this.setState(ConnectionState.Disconnected);
        if (!options.quiet) {
          vscode.window.showErrorMessage(
            "Could not connect to Sonic Pi — no response to ping. " +
              "Is Sonic Pi running?"
          );
        }
        return;
      }

      this.setState(ConnectionState.Connected);
    } catch (err) {
      await this.teardownTransport();
      this.setState(ConnectionState.Disconnected);
      if (!options.quiet) {
        const msg =
          err instanceof Error ? err.message : "Unknown connection error";
        vscode.window.showErrorMessage(`Sonic Pi connection failed: ${msg}`);
      }
    }
  }

  private async pingWithRetry(): Promise<boolean> {
    if (!this._transport) return false;

    for (let attempt = 0; attempt < MAX_PING_RETRIES; attempt++) {
      const ack = await this._transport.request(
        "/ping",
        "/ack",
        PING_TIMEOUT_MS,
        "vscode-init"
      );
      if (ack) return true;
    }

    return false;
  }

  /**
   * Tear down the current daemon and boot a fresh one. Needed when the
   * daemon's audio server is stuck on a stale output device: scsynth keeps
   * the device it opened at boot, so switching the system output (e.g. from
   * a monitor to speakers) silences Sonic Pi until the daemon restarts.
   */
  async restartDaemon(options: ConnectOptions = {}): Promise<void> {
    await this.disconnect();
    this._daemonSpawner.kill();
    this._portDiscovery.clearDiscoveredPortInfo();
    await this.connect(options);
  }

  async disconnect(): Promise<void> {
    if (
      this._state === ConnectionState.Disconnected ||
      this._state === ConnectionState.Disconnecting
    ) {
      return;
    }

    this.setState(ConnectionState.Disconnecting);

    this._heartbeat?.dispose();
    this._heartbeat = undefined;

    await this.teardownTransport();

    this.setState(ConnectionState.Disconnected);
  }

  dispose(): void {
    this.disconnect();
    this._onDidChangeState.dispose();
    this._onDidReceiveMessage.dispose();
  }
}
