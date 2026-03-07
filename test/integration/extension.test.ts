import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

let serverMessageCb: ((msg: unknown[]) => void) | undefined;
const sentMessages: Array<{ address: string; args: any[] }> = [];

const mocks = vi.hoisted(() => ({
  clientSend: vi.fn((...args: any[]) => {
    return Promise.resolve();
  }),
  clientClose: vi.fn(() => Promise.resolve()),
  clientOn: vi.fn(),
  serverClose: vi.fn(() => Promise.resolve()),
}));

vi.mock("node-osc", () => {
  class MockClient {
    send = (...args: any[]) => {
      const address = args[0] as string;
      const rest = args.slice(1);
      sentMessages.push({ address, args: rest });

      if (address === "/ping") {
        setTimeout(() => serverMessageCb?.(["/ack", "ok"]), 5);
      }

      return mocks.clientSend(...args);
    };
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
import { LogManager } from "../../src/log/LogManager";
import { ConnectionState } from "../../src/types/sonicpi";

describe("Extension Integration", () => {
  let connectionManager: ConnectionManager;
  let logManager: LogManager;

  beforeEach(() => {
    vi.clearAllMocks();
    sentMessages.length = 0;
    serverMessageCb = undefined;

    mocks.clientSend.mockImplementation(() => Promise.resolve());

    const config = new ConfigManager();
    const portDiscovery = new PortDiscovery({
      configSendPort: 4557,
      configListenPort: 4558,
      configDaemonPort: 4560,
    });
    const daemonSpawner = new DaemonSpawner("/nonexistent");

    connectionManager = new ConnectionManager(
      config,
      portDiscovery,
      daemonSpawner
    );

    logManager = new LogManager();

    connectionManager.onDidReceiveMessage((msg) => {
      logManager.handleMessage(msg);
    });
  });

  afterEach(async () => {
    await connectionManager.disconnect();
    connectionManager.dispose();
    logManager.dispose();
  });

  it("sends /ping on connect and receives /ack", async () => {
    await connectionManager.connect();

    expect(connectionManager.state).toBe(ConnectionState.Connected);

    const pingMsg = sentMessages.find((m) => m.address === "/ping");
    expect(pingMsg).toBeDefined();
  });

  it("sends /stop-all-jobs with token on stop command", async () => {
    await connectionManager.connect();

    await connectionManager.transport!.send("/stop-all-jobs");

    const stopMsg = sentMessages.find(
      (m) => m.address === "/stop-all-jobs"
    );
    expect(stopMsg).toBeDefined();
  });

  it("sends /save-and-run-buffer with token and code", async () => {
    await connectionManager.connect();

    await connectionManager.transport!.send(
      "/save-and-run-buffer",
      "buffer-0",
      'play :c4',
      "/test/file.spi"
    );

    const runMsg = sentMessages.find(
      (m) => m.address === "/save-and-run-buffer"
    );
    expect(runMsg).toBeDefined();
    expect(runMsg!.args).toContain("buffer-0");
    expect(runMsg!.args).toContain('play :c4');
  });

  it("processes /log/multi_message from server", async () => {
    await connectionManager.connect();

    serverMessageCb?.([
      "/log/multi_message",
      1,
      "live_loop",
      "0.123",
      1,
      0,
      "play :c4",
    ]);

    // LogManager should have processed the message without error
    expect(connectionManager.isConnected).toBe(true);
  });

  it("processes /error from server", async () => {
    await connectionManager.connect();

    serverMessageCb?.([
      "/error",
      1,
      "RuntimeError",
      "undefined method 'foo'",
      5,
    ]);

    expect(connectionManager.isConnected).toBe(true);
  });

  it("disconnects cleanly", async () => {
    await connectionManager.connect();
    expect(connectionManager.isConnected).toBe(true);

    await connectionManager.disconnect();
    expect(connectionManager.state).toBe(ConnectionState.Disconnected);
    expect(connectionManager.isConnected).toBe(false);
  });
});
