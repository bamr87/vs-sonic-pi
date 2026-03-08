import { ChildProcess, spawn } from "child_process";
import { existsSync } from "fs";
import { platform } from "os";
import * as vscode from "vscode";
import { PortMap } from "../types/sonicpi.js";
import { parseDaemonOutput, savePortInfo } from "./PortDiscovery.js";

const DAEMON_RB_SUFFIX = "app/server/ruby/bin/daemon.rb";

const PLATFORM_PATHS: Record<string, string[]> = {
  darwin: [
    `/Applications/Sonic Pi.app/Contents/Resources/${DAEMON_RB_SUFFIX}`,
  ],
  linux: [
    `/usr/lib/sonic-pi/${DAEMON_RB_SUFFIX}`,
    `/opt/sonic-pi/${DAEMON_RB_SUFFIX}`,
  ],
  win32: [
    `C:\\Program Files\\Sonic Pi\\${DAEMON_RB_SUFFIX.replace(/\//g, "\\")}`,
    `C:\\Program Files (x86)\\Sonic Pi\\${DAEMON_RB_SUFFIX.replace(/\//g, "\\")}`,
  ],
};

export class DaemonSpawner implements vscode.Disposable {
  private _process: ChildProcess | undefined;
  private _disposed = false;

  constructor(private readonly _customPath?: string) {}

  findDaemonPath(): string | undefined {
    if (this._customPath) {
      const daemonRb = this._customPath.endsWith("daemon.rb")
        ? this._customPath
        : `${this._customPath}/${DAEMON_RB_SUFFIX}`;
      if (existsSync(daemonRb)) return daemonRb;
    }

    const envHome = process.env.SONIC_PI_HOME;
    if (envHome) {
      const envDaemon = `${envHome}/${DAEMON_RB_SUFFIX}`;
      if (existsSync(envDaemon)) return envDaemon;
    }

    const paths = PLATFORM_PATHS[platform()] || [];
    for (const p of paths) {
      if (existsSync(p)) return p;
    }

    return undefined;
  }

  /**
   * Spawn the daemon and parse its STDOUT for ports and token.
   * Resolves with the PortMap once the daemon prints its port line.
   * Rejects if the daemon fails to start or prints an error.
   */
  async spawn(): Promise<PortMap> {
    const daemonPath = this.findDaemonPath();
    if (!daemonPath) {
      throw new Error(
        "Could not find Sonic Pi daemon.rb. " +
          "Set sonicpi.sonicPiPath in settings to your Sonic Pi installation."
      );
    }

    return new Promise<PortMap>((resolve, reject) => {
      const proc = spawn("ruby", [daemonPath], {
        stdio: ["pipe", "pipe", "pipe"],
        detached: false,
      });

      this._process = proc;
      let stdoutBuffer = "";
      let resolved = false;

      proc.stdout?.on("data", (data: Buffer) => {
        stdoutBuffer += data.toString();
        const lines = stdoutBuffer.split("\n");

        for (const line of lines) {
          if (resolved) break;
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith("SuperCollider Audio Server Boot Error")) {
            resolved = true;
            reject(new Error(`Sonic Pi boot error: ${trimmed}`));
            return;
          }

          const ports = parseDaemonOutput(trimmed);
          if (ports) {
            resolved = true;
            // Persist ports so reconnection can find a running daemon
            const sonicPiHome =
              this._customPath ||
              process.env.SONIC_PI_HOME;
            if (sonicPiHome) {
              savePortInfo(sonicPiHome, trimmed);
            }
            resolve(ports);
            return;
          }
        }
      });

      proc.stderr?.on("data", (data: Buffer) => {
        console.error("[Sonic Pi Daemon stderr]", data.toString());
      });

      proc.on("error", (err) => {
        if (!resolved) {
          resolved = true;
          reject(
            new Error(`Failed to spawn Sonic Pi daemon: ${err.message}`)
          );
        }
      });

      proc.on("exit", (code) => {
        if (!resolved) {
          resolved = true;
          reject(
            new Error(
              `Sonic Pi daemon exited with code ${code} before providing ports`
            )
          );
        }
      });

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.kill();
          reject(new Error("Sonic Pi daemon timed out (30s)"));
        }
      }, 30000);

      proc.on("exit", () => clearTimeout(timeout));
    });
  }

  kill(): void {
    if (this._process && !this._process.killed) {
      this._process.kill("SIGTERM");
      this._process = undefined;
    }
  }

  get isRunning(): boolean {
    return !!this._process && !this._process.killed;
  }

  dispose(): void {
    this._disposed = true;
    this.kill();
  }
}
