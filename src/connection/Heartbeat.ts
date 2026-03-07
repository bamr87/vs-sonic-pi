import * as vscode from "vscode";
import { Client } from "node-osc";

/**
 * Sends periodic /daemon/keep-alive messages to the daemon port.
 * The daemon's timeout is 3s, so the default interval is 2s.
 */
export class Heartbeat implements vscode.Disposable {
  private _timer: ReturnType<typeof setInterval> | undefined;
  private _client: Client | undefined;
  private readonly _host: string;
  private readonly _daemonPort: number;
  private readonly _token: number;
  private readonly _intervalMs: number;

  constructor(
    host: string,
    daemonPort: number,
    token: number,
    intervalMs = 2000
  ) {
    this._host = host;
    this._daemonPort = daemonPort;
    this._token = token;
    this._intervalMs = intervalMs;
  }

  start(): void {
    if (this._timer) return;

    this._client = new Client(this._host, this._daemonPort);
    this._client.on("error", () => {
      /* swallow heartbeat send errors */
    });

    this._timer = setInterval(() => {
      this._client?.send("/daemon/keep-alive", this._token);
    }, this._intervalMs);

    this._client.send("/daemon/keep-alive", this._token);
  }

  stop(): void {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = undefined;
    }
    if (this._client) {
      this._client.close().catch(() => {});
      this._client = undefined;
    }
  }

  dispose(): void {
    this.stop();
  }
}
