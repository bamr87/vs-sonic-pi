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

  async connect(): Promise<void> {
    if (
      this._state === ConnectionState.Connected ||
      this._state === ConnectionState.Connecting
    ) {
      return;
    }

    this.setState(ConnectionState.Connecting);

    try {
      let ports: PortMap;

      // Check if an existing daemon left a port-info file
      const existingPorts = this._portDiscovery.discoverFromPortFile();

      if (existingPorts) {
        ports = existingPorts;
      } else if (this._daemonSpawner.findDaemonPath() && !this._daemonSpawner.isRunning) {
        try {
          ports = await this._daemonSpawner.spawn();
        } catch {
          ports = this._portDiscovery.discover();
        }
      } else {
        ports = this._portDiscovery.discover();
      }

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

      this._transport.onMessage("/exited", () => {
        this.disconnect();
      });

      this._transport.onMessage("/exited-with-boot-error", () => {
        vscode.window.showErrorMessage(
          "Sonic Pi exited with a boot error. Check the Sonic Pi log for details."
        );
        this.disconnect();
      });

      const ackReceived = await this.pingWithRetry();

      if (!ackReceived) {
        await this._transport.dispose();
        this._transport = undefined;
        this.setState(ConnectionState.Disconnected);
        vscode.window.showErrorMessage(
          "Could not connect to Sonic Pi — no response to ping. " +
            "Is Sonic Pi running?"
        );
        return;
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

      this.setState(ConnectionState.Connected);
    } catch (err) {
      this.setState(ConnectionState.Disconnected);
      const msg =
        err instanceof Error ? err.message : "Unknown connection error";
      vscode.window.showErrorMessage(`Sonic Pi connection failed: ${msg}`);
    }
  }

  private async pingWithRetry(): Promise<boolean> {
    if (!this._transport) return false;

    for (let attempt = 0; attempt < MAX_PING_RETRIES; attempt++) {
      const gotAck = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), PING_TIMEOUT_MS);

        const disposable = this._transport!.onMessage("/ack", () => {
          clearTimeout(timeout);
          disposable.dispose();
          resolve(true);
        });

        this._transport!.send("/ping", "vscode-init").catch(() => {
          clearTimeout(timeout);
          disposable.dispose();
          resolve(false);
        });
      });

      if (gotAck) return true;
    }

    return false;
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

    for (const d of this._messageDisposables) {
      d.dispose();
    }
    this._messageDisposables = [];

    if (this._transport) {
      await this._transport.dispose();
      this._transport = undefined;
    }

    this._portMap = undefined;
    this.setState(ConnectionState.Disconnected);
  }

  dispose(): void {
    this.disconnect();
    this._onDidChangeState.dispose();
    this._onDidReceiveMessage.dispose();
  }
}
