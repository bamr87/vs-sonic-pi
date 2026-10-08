import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
} from "fs";
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

/** Well-known filename where ports are persisted after daemon spawn. */
const PORT_INFO_FILE = "port-info";

/**
 * Save a PortMap to a port-info file in the given Sonic Pi home directory.
 */
export function savePortInfo(sonicPiHome: string, portLine: string): void {
  const dir = join(sonicPiHome, ".sonic-pi");
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, PORT_INFO_FILE), portLine.trim() + "\n");
  } catch {
    // Best-effort; file may not be writable
  }
}

/**
 * Read a saved port-info file and return ports, or undefined.
 */
export function readPortInfo(sonicPiHome: string): PortMap | undefined {
  const filePath = join(sonicPiHome, ".sonic-pi", PORT_INFO_FILE);
  if (!existsSync(filePath)) return undefined;
  try {
    const content = readFileSync(filePath, "utf-8").trim();
    return parseDaemonOutput(content);
  } catch {
    return undefined;
  }
}

/**
 * Delete a saved port-info file if it exists.
 */
export function clearPortInfo(sonicPiHome: string): void {
  const filePath = join(sonicPiHome, ".sonic-pi", PORT_INFO_FILE);
  if (!existsSync(filePath)) return;

  try {
    unlinkSync(filePath);
  } catch {
    // Best-effort cleanup.
  }
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
   * Try to discover ports from a saved port-info file.
   * Checks SONIC_PI_HOME and ~/.sonic-pi.
   */
  discoverFromPortFile(): PortMap | undefined {
    const candidates = [
      process.env.SONIC_PI_HOME,
      homedir(),
    ].filter(Boolean) as string[];

    for (const base of candidates) {
      const ports = readPortInfo(base);
      if (ports) return ports;
    }

    return undefined;
  }

  /**
   * Clear discovered port-info files from known locations.
   */
  clearDiscoveredPortInfo(): void {
    const candidates = [
      process.env.SONIC_PI_HOME,
      homedir(),
    ].filter(Boolean) as string[];

    for (const base of candidates) {
      clearPortInfo(base);
    }
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
   * Build a PortMap from config/defaults without reading persisted files.
   */
  discoverFromConfigAndDefaults(): PortMap {
    const cfg = this.fromConfig();
    const defs = this.defaults();

    return {
      ...defs,
      ...cfg,
    } as PortMap;
  }

  /**
   * 4-tier discovery strategy:
   * 1. Daemon STDOUT (if provided)
   * 2. Saved port-info file
   * 3. User config
   * 4. Defaults
   */
  discover(daemonOutput?: string): PortMap {
    if (daemonOutput) {
      const parsed = parseDaemonOutput(daemonOutput);
      if (parsed) return parsed;
    }

    const fromFile = this.discoverFromPortFile();
    if (fromFile) return fromFile;

    return this.discoverFromConfigAndDefaults();
  }
}
