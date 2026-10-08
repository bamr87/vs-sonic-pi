import * as vscode from "vscode";
import { Client, Server } from "node-osc";
import type { Socket } from "dgram";
import { OscArgument, OscMessage, OscMessageHandler } from "../types/osc.js";

export interface OscTransportOptions {
  host: string;
  sendPort: number;
  listenPort: number;
  token: number;
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

/**
 * macOS rejects UDP datagrams larger than net.inet.udp.maxdgram (9216 bytes
 * by default) unless the socket's send buffer is larger, so running a buffer
 * over ~9KB fails with EMSGSIZE before it ever reaches Sonic Pi. Bind the
 * client socket eagerly and lift SO_SNDBUF so a whole-file
 * /save-and-run-buffer message fits in one datagram (UDP's hard ceiling of
 * ~64KB still applies).
 */
const SEND_BUFFER_BYTES = 4 * 1024 * 1024;

function raiseSendBufferSize(client: Client): void {
  const sock = (client as unknown as { _sock?: Socket })._sock;
  if (!sock) return;
  sock.bind(0, () => {
    try {
      sock.setSendBufferSize(SEND_BUFFER_BYTES);
    } catch {
      // Best effort — smaller buffers still send under the OS cap.
    }
  });
}

/**
 * The listen socket must bind a local interface. When talking to a remote
 * Sonic Pi we bind all interfaces so its replies can reach us; locally we
 * stay on loopback.
 */
export function listenHostFor(remoteHost: string): string {
  return LOOPBACK_HOSTS.has(remoteHost) ? "127.0.0.1" : "0.0.0.0";
}

export class OscTransport implements vscode.Disposable {
  private _client: Client | undefined;
  private _server: Server | undefined;
  private _handlers = new Map<string, Set<OscMessageHandler>>();
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
    raiseSendBufferSize(this._client);

    return new Promise<void>((resolve, reject) => {
      try {
        this._server = new Server(
          this._listenPort,
          listenHostFor(this._host),
          () => {
            this._isOpen = true;
            resolve();
          }
        );

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
            for (const handler of [...handlers]) {
              handler(oscMsg);
            }
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

  /**
   * Send a message and wait for the first reply on `replyAddress`.
   * Resolves with the reply, or undefined on timeout or send failure.
   */
  async request(
    sendAddress: string,
    replyAddress: string,
    timeoutMs: number,
    ...args: OscArgument[]
  ): Promise<OscMessage | undefined> {
    return new Promise<OscMessage | undefined>((resolve) => {
      const timeout = setTimeout(() => {
        disposable.dispose();
        resolve(undefined);
      }, timeoutMs);

      const disposable = this.onMessage(replyAddress, (msg) => {
        clearTimeout(timeout);
        disposable.dispose();
        resolve(msg);
      });

      this.send(sendAddress, ...args).catch(() => {
        clearTimeout(timeout);
        disposable.dispose();
        resolve(undefined);
      });
    });
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
    return this._onDidReceiveMessage.event(handler);
  }

  async dispose(): Promise<void> {
    this._isOpen = false;
    this._handlers.clear();
    this._onDidReceiveMessage.dispose();
    this._onError.dispose();

    const closePromises: Promise<void>[] = [];

    if (this._client) {
      const closing = this._client.close()?.catch(() => {
        /* ignore close errors */
      });
      if (closing) closePromises.push(closing);
      this._client = undefined;
    }

    if (this._server) {
      const closing = this._server.close()?.catch(() => {
        /* ignore close errors */
      });
      if (closing) closePromises.push(closing);
      this._server = undefined;
    }

    await Promise.all(closePromises);
  }
}
