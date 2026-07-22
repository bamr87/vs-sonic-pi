import { ChildProcess, spawn } from "child_process";
import { existsSync } from "fs";
import { homedir, platform } from "os";
import { join } from "path";
import { Client } from "node-osc";
import * as vscode from "vscode";
import { PortMap } from "../types/sonicpi.js";
import { parseDaemonOutput, savePortInfo, clearPortInfo } from "./PortDiscovery.js";

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

/**
 * Sonic Pi ships its own Ruby under app/server/native/ruby/bin. The system
 * `ruby` (if present at all) is often too old to run daemon.rb, so prefer
 * the bundled interpreter next to the daemon script.
 */
export function findRubyForDaemon(daemonRbPath: string): string {
  const marker = join("app", "server", "ruby", "bin");
  const idx = daemonRbPath.lastIndexOf(marker);
  if (idx !== -1) {
    const root = daemonRbPath.slice(0, idx);
    const exe = platform() === "win32" ? "ruby.exe" : "ruby";
    const bundled = join(root, "app", "server", "native", "ruby", "bin", exe);
    if (existsSync(bundled)) return bundled;
  }
  return "ruby";
}

export interface DaemonSpawnerOptions {
  /**
   * Ask scsynth to open audio inputs (needed for live_audio). Off by
   * default: opening the microphone from the VS Code process triggers a
   * macOS permission prompt and can silently break audio when the input
   * device's sample rate differs from the output's.
   */
  audioInputs?: boolean;
}

export class DaemonSpawner implements vscode.Disposable {
  private _process: ChildProcess | undefined;
  private _portMap: PortMap | undefined;
  private _portInfoHome: string | undefined;

  constructor(
    private readonly _customPath?: string,
    private readonly _opts: DaemonSpawnerOptions = {}
  ) {}

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

    // daemon.rb only checks ARGV[0], so the flag must come right after the
    // script path.
    const daemonArgs = this._opts.audioInputs
      ? [daemonPath]
      : [daemonPath, "--no-scsynth-inputs"];

    return new Promise<PortMap>((resolve, reject) => {
      const proc = spawn(findRubyForDaemon(daemonPath), daemonArgs, {
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
            this._portMap = ports;
            // Persist ports where PortDiscovery looks for them, so a later
            // reconnect (or another window) can reuse this daemon.
            this._portInfoHome = process.env.SONIC_PI_HOME || homedir();
            savePortInfo(this._portInfoHome, trimmed);
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
        // Only clean up if this spawn is still the current one — after a
        // restart the old process exits late and must not delete the new
        // daemon's port-info file.
        if (this._process === proc) {
          this._process = undefined;
          if (this._portInfoHome) {
            clearPortInfo(this._portInfoHome);
            this._portInfoHome = undefined;
          }
        }
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

  /**
   * Ask the daemon to shut down cleanly (/daemon/exit stops spider, scsynth
   * and tau), falling back to SIGTERM if it hasn't exited shortly after.
   */
  kill(): void {
    const proc = this._process;
    if (!proc || proc.killed) {
      this._process = undefined;
      return;
    }

    const ports = this._portMap;
    if (ports && ports.daemon > 0) {
      try {
        const client = new Client("127.0.0.1", ports.daemon);
        client.send("/daemon/exit", ports.token, () => {
          client.close()?.catch(() => {});
        });
        const fallback = setTimeout(() => {
          if (!proc.killed && proc.exitCode === null) {
            proc.kill("SIGTERM");
          }
        }, 2000);
        proc.on("exit", () => clearTimeout(fallback));
      } catch {
        proc.kill("SIGTERM");
      }
    } else {
      proc.kill("SIGTERM");
    }

    this._process = undefined;
    this._portMap = undefined;
    if (this._portInfoHome) {
      clearPortInfo(this._portInfoHome);
      this._portInfoHome = undefined;
    }
  }

  get isRunning(): boolean {
    return !!this._process && !this._process.killed;
  }

  dispose(): void {
    this.kill();
  }
}
