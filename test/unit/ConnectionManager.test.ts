import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConnectionState } from "../../src/types/sonicpi";

let serverMessageCb: ((msg: unknown[]) => void) | undefined;

const mocks = vi.hoisted(() => ({
  clientSend: vi.fn(() => Promise.resolve()),
  clientClose: vi.fn(() => Promise.resolve()),
  clientOn: vi.fn(),
  serverClose: vi.fn(() => Promise.resolve()),
}));

vi.mock("node-osc", () => {
  class MockClient {
    send = mocks.clientSend;
    close = mocks.clientClose;
    on = mocks.clientOn;
    constructor(..._args: any[]) {}
  }

  class MockServer {
    on: ReturnType<typeof vi.fn>;
    close = mocks.serverClose;
    constructor(_port: number, _host: string, cb?: () => void) {
      this.on = vi.fn((event: string, handler: (...args: any[]) => void) => {
        if (event === "message") {
          serverMessageCb = handler as (msg: unknown[]) => void;
        }
      });
      setTimeout(() => cb?.(), 0);
    }
  }

  return { Client: MockClient, Server: MockServer };
});

import { ConnectionManager } from "../../src/connection/ConnectionManager";
import { ConfigManager } from "../../src/config/ConfigManager";
import { PortDiscovery } from "../../src/connection/PortDiscovery";
import { DaemonSpawner } from "../../src/connection/DaemonSpawner";

function createManager() {
  const config = new ConfigManager();
  const portDiscovery = new PortDiscovery({
    configSendPort: 4557,
    configListenPort: 4558,
    configDaemonPort: 4560,
  });
  const daemonSpawner = new DaemonSpawner("/nonexistent");

  return new ConnectionManager(config, portDiscovery, daemonSpawner);
}

describe("ConnectionManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverMessageCb = undefined;

    mocks.clientSend.mockImplementation(
      (address: string, ..._args: any[]) => {
        if (address === "/ping") {
          setTimeout(() => serverMessageCb?.(["/ack", "ok"]), 5);
        }
        return Promise.resolve();
      }
    );
  });

  it("starts in Disconnected state", () => {
    const cm = createManager();
    expect(cm.state).toBe(ConnectionState.Disconnected);
    cm.dispose();
  });

  it("transitions through Connecting to Connected on successful ping", async () => {
    const cm = createManager();
    const states: ConnectionState[] = [];
    cm.onDidChangeState((s) => states.push(s));

    await cm.connect();

    expect(states).toContain(ConnectionState.Connecting);
    expect(cm.state).toBe(ConnectionState.Connected);
    expect(cm.isConnected).toBe(true);

    cm.dispose();
  });

  it("transitions to Disconnected on disconnect", async () => {
    const cm = createManager();

    await cm.connect();

    await cm.disconnect();
    expect(cm.state).toBe(ConnectionState.Disconnected);
    expect(cm.isConnected).toBe(false);

    cm.dispose();
  });

  it("does not double-connect", async () => {
    const cm = createManager();

    const p1 = cm.connect();
    const p2 = cm.connect();

    await p1;
    await p2;

    expect(cm.state).toBe(ConnectionState.Connected);
    cm.dispose();
  });
});
