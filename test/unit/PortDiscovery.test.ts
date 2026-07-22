import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, it, expect, vi } from "vitest";

// Isolate from the host machine: a live ~/.sonic-pi/port-info (present
// whenever Sonic Pi is running locally) must not leak into discovery tests.
vi.mock("os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("os")>();
  return {
    ...actual,
    homedir: () => join(actual.tmpdir(), "vs-sonicpi-nonexistent-home"),
  };
});
import {
  parseDaemonOutput,
  PortDiscovery,
  savePortInfo,
  readPortInfo,
  clearPortInfo,
} from "../../src/connection/PortDiscovery";

describe("parseDaemonOutput", () => {
  it("parses a valid 8-value daemon STDOUT line", () => {
    const line = "4560 4558 4557 4556 4559 4561 4562 123456789";
    const result = parseDaemonOutput(line);
    expect(result).toEqual({
      daemon: 4560,
      guiListenToServer: 4558,
      guiSendToServer: 4557,
      scsynth: 4556,
      oscCues: 4559,
      tauApi: 4561,
      tauPhx: 4562,
      token: 123456789,
    });
  });

  it("handles extra whitespace", () => {
    const line = "  4560  4558  4557  4556  4559  4561  4562  99999  ";
    const result = parseDaemonOutput(line);
    expect(result).toBeDefined();
    expect(result!.daemon).toBe(4560);
    expect(result!.token).toBe(99999);
  });

  it("returns undefined for fewer than 8 values", () => {
    expect(parseDaemonOutput("4560 4558 4557")).toBeUndefined();
  });

  it("returns undefined for non-numeric values", () => {
    expect(
      parseDaemonOutput("4560 4558 4557 abc 4559 4561 4562 123")
    ).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(parseDaemonOutput("")).toBeUndefined();
  });
});

describe("PortDiscovery", () => {
  it("returns defaults when no other source available", () => {
    const pd = new PortDiscovery();
    const ports = pd.defaults();
    expect(ports.guiSendToServer).toBe(4557);
    expect(ports.guiListenToServer).toBe(4558);
  });

  it("prefers daemon output over defaults", () => {
    const pd = new PortDiscovery();
    const daemonLine = "5000 5001 5002 5003 5004 5005 5006 42";
    const ports = pd.discover(daemonLine);
    expect(ports.daemon).toBe(5000);
    expect(ports.guiListenToServer).toBe(5001);
    expect(ports.guiSendToServer).toBe(5002);
    expect(ports.token).toBe(42);
  });

  it("falls back to config when daemon output is invalid", () => {
    const pd = new PortDiscovery({
      configSendPort: 9000,
      configListenPort: 9001,
    });
    const ports = pd.discover("invalid");
    expect(ports.guiSendToServer).toBe(9000);
    expect(ports.guiListenToServer).toBe(9001);
  });

  it("saves and reads port-info from a Sonic Pi home directory", () => {
    const tempHome = mkdtempSync(join(tmpdir(), "vs-sonicpi-ports-"));
    const line = "6000 6001 6002 6003 6004 6005 6006 777";

    try {
      savePortInfo(tempHome, line);
      const ports = readPortInfo(tempHome);
      expect(ports).toBeDefined();
      expect(ports?.daemon).toBe(6000);
      expect(ports?.token).toBe(777);
    } finally {
      rmSync(tempHome, { recursive: true, force: true });
    }
  });

  it("discoverFromPortFile prefers SONIC_PI_HOME when set", () => {
    const tempHome = mkdtempSync(join(tmpdir(), "vs-sonicpi-discover-"));
    const previousHome = process.env.SONIC_PI_HOME;

    try {
      process.env.SONIC_PI_HOME = tempHome;
      savePortInfo(tempHome, "7000 7001 7002 7003 7004 7005 7006 888");

      const pd = new PortDiscovery();
      const ports = pd.discoverFromPortFile();

      expect(ports).toBeDefined();
      expect(ports?.guiSendToServer).toBe(7002);
      expect(ports?.token).toBe(888);
    } finally {
      if (previousHome === undefined) {
        delete process.env.SONIC_PI_HOME;
      } else {
        process.env.SONIC_PI_HOME = previousHome;
      }
      rmSync(tempHome, { recursive: true, force: true });
    }
  });

  it("clearDiscoveredPortInfo removes persisted port-info", () => {
    const tempHome = mkdtempSync(join(tmpdir(), "vs-sonicpi-clear-"));
    const previousHome = process.env.SONIC_PI_HOME;

    try {
      process.env.SONIC_PI_HOME = tempHome;
      savePortInfo(tempHome, "8000 8001 8002 8003 8004 8005 8006 999");

      const pd = new PortDiscovery();
      expect(pd.discoverFromPortFile()).toBeDefined();

      pd.clearDiscoveredPortInfo();
      expect(pd.discoverFromPortFile()).toBeUndefined();
    } finally {
      if (previousHome === undefined) {
        delete process.env.SONIC_PI_HOME;
      } else {
        process.env.SONIC_PI_HOME = previousHome;
      }
      clearPortInfo(tempHome);
      rmSync(tempHome, { recursive: true, force: true });
    }
  });
});
