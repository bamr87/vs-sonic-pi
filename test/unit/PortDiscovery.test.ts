import { describe, it, expect } from "vitest";
import { parseDaemonOutput, PortDiscovery } from "../../src/connection/PortDiscovery";

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
});
