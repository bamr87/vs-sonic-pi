import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { PortMap } from "../types/sonicpi.js";

/**
 * Daemon STDOUT format (8 space-separated integers):
 * daemon gui-listen-to-spider gui-send-to-spider scsynth osc-cues tau tau-phx token
 */
export function parseDaemonOutput(line: string): PortMap | undefined {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 8) return undefined;

  const nums = parts.map(Number);
  if (nums.some(isNaN)) return undefined;

  return {
    daemon: nums[0],
    guiListenToServer: nums[1],
    guiSendToServer: nums[2],
    scsynth: nums[3],
    oscCues: nums[4],
    tauApi: nums[5],
    tauPhx: nums[6],
    token: nums[7],
  };
}

export interface PortDiscoveryOptions {
  configSendPort?: number;
  configListenPort?: number;
  configDaemonPort?: number;
}

export class PortDiscovery {
  private readonly _opts: PortDiscoveryOptions;

  constructor(opts: PortDiscoveryOptions = {}) {
    this._opts = opts;
  }

  /**
   * Try to discover ports from the Sonic Pi log directory.
   * The daemon writes a spider.log that may contain port info.
   */
  discoverFromLogs(): PortMap | undefined {
    const logDir = join(homedir(), ".sonic-pi", "log");
    const spiderLog = join(logDir, "spider.log");

    if (!existsSync(spiderLog)) return undefined;

    try {
      const content = readFileSync(spiderLog, "utf-8");
      const lines = content.split("\n");

      for (const line of lines) {
        const match = line.match(
          /Ports:\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/
        );
        if (match) {
          return {
            daemon: Number(match[1]),
            guiListenToServer: Number(match[2]),
            guiSendToServer: Number(match[3]),
            scsynth: Number(match[4]),
            oscCues: Number(match[5]),
            tauApi: Number(match[6]),
            tauPhx: Number(match[7]),
            token: Number(match[8]),
          };
        }
      }
    } catch {
      // Log file unreadable
    }

    return undefined;
  }

  /**
   * Build a PortMap from user config overrides, filling in defaults.
   */
  fromConfig(): Partial<PortMap> {
    return {
      guiSendToServer: this._opts.configSendPort || 4557,
      guiListenToServer: this._opts.configListenPort || 4558,
      daemon: this._opts.configDaemonPort || 0,
    };
  }

  /**
   * Return default ports (Sonic Pi's well-known defaults).
   */
  defaults(): PortMap {
    return {
      daemon: 0,
      guiListenToServer: 4558,
      guiSendToServer: 4557,
      scsynth: 4556,
      oscCues: 4560,
      tauApi: 0,
      tauPhx: 0,
      token: 0,
    };
  }

  /**
   * 4-tier discovery strategy:
   * 1. Daemon STDOUT (if provided)
   * 2. Log files
   * 3. User config
   * 4. Defaults
   */
  discover(daemonOutput?: string): PortMap {
    if (daemonOutput) {
      const parsed = parseDaemonOutput(daemonOutput);
      if (parsed) return parsed;
    }

    const fromLogs = this.discoverFromLogs();
    if (fromLogs) return fromLogs;

    const cfg = this.fromConfig();
    const defs = this.defaults();

    return {
      ...defs,
      ...cfg,
    } as PortMap;
  }
}
