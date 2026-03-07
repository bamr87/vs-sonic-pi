import * as vscode from "vscode";
import { Client, Server } from "node-osc";
import { OscArgument, OscMessage, OscMessageHandler } from "../types/osc.js";

export interface OscTransportOptions {
  host: string;
  sendPort: number;
  listenPort: number;
  token: number;
}

export class OscTransport implements vscode.Disposable {
  private _client: Client | undefined;
  private _server: Server | undefined;
  private _handlers = new Map<string, Set<OscMessageHandler>>();
  private _globalHandlers = new Set<OscMessageHandler>();
  private _isOpen = false;

  private readonly _host: string;
  private readonly _sendPort: number;
  private readonly _listenPort: number;
  private readonly _token: number;

  private readonly _onDidReceiveMessage =
    new vscode.EventEmitter<OscMessage>();
  readonly onDidReceiveMessage = this._onDidReceiveMessage.event;

  private readonly _onError = new vscode.EventEmitter<Error>();
  readonly onError = this._onError.event;

  constructor(opts: OscTransportOptions) {
    this._host = opts.host;
    this._sendPort = opts.sendPort;
    this._listenPort = opts.listenPort;
    this._token = opts.token;
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  get token(): number {
    return this._token;
  }

  async open(): Promise<void> {
    if (this._isOpen) return;

    this._client = new Client(this._host, this._sendPort);
    this._client.on("error", (err: Error) => this._onError.fire(err));

    return new Promise<void>((resolve, reject) => {
      try {
        this._server = new Server(this._listenPort, this._host, () => {
          this._isOpen = true;
          resolve();
        });

        this._server.on("error", (err: Error) => {
          if (!this._isOpen) {
            reject(err);
          }
          this._onError.fire(err);
        });

        this._server.on("message", (msg: unknown[]) => {
          const address = msg[0] as string;
          const args = msg.slice(1) as OscArgument[];
          const oscMsg: OscMessage = { address, args };

          this._onDidReceiveMessage.fire(oscMsg);

          const handlers = this._handlers.get(address);
          if (handlers) {
            for (const handler of handlers) {
              handler(oscMsg);
            }
          }

          for (const handler of this._globalHandlers) {
            handler(oscMsg);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Send an OSC message. The auth token is automatically prepended
   * as the first argument.
   */
  async send(address: string, ...args: OscArgument[]): Promise<void> {
    if (!this._client || !this._isOpen) {
      throw new Error("OscTransport is not open");
    }
    await this._client.send(address, this._token, ...args);
  }

  /**
   * Send a raw OSC message without prepending the token.
   * Used for daemon keep-alive which has its own format.
   */
  async sendRaw(address: string, ...args: OscArgument[]): Promise<void> {
    if (!this._client || !this._isOpen) {
      throw new Error("OscTransport is not open");
    }
    await this._client.send(address, ...args);
  }

  onMessage(address: string, handler: OscMessageHandler): vscode.Disposable {
    let handlers = this._handlers.get(address);
    if (!handlers) {
      handlers = new Set();
      this._handlers.set(address, handlers);
    }
    handlers.add(handler);

    return new vscode.Disposable(() => {
      handlers!.delete(handler);
      if (handlers!.size === 0) {
        this._handlers.delete(address);
      }
    });
  }

  onAnyMessage(handler: OscMessageHandler): vscode.Disposable {
    this._globalHandlers.add(handler);
    return new vscode.Disposable(() => {
      this._globalHandlers.delete(handler);
    });
  }

  async dispose(): Promise<void> {
    this._isOpen = false;
    this._handlers.clear();
    this._globalHandlers.clear();
    this._onDidReceiveMessage.dispose();
    this._onError.dispose();

    const closePromises: Promise<void>[] = [];

    if (this._client) {
      closePromises.push(
        this._client.close().catch(() => {
          /* ignore close errors */
        })
      );
      this._client = undefined;
    }

    if (this._server) {
      closePromises.push(
        this._server.close().catch(() => {
          /* ignore close errors */
        })
      );
      this._server = undefined;
    }

    await Promise.all(closePromises);
  }
}
