import { describe, it, expect, vi, beforeEach } from "vitest";

let serverMessageCb: ((msg: unknown[]) => void) | undefined;

const mocks = vi.hoisted(() => ({
  clientSend: vi.fn(() => Promise.resolve()),
  clientClose: vi.fn(() => Promise.resolve()),
  clientOn: vi.fn(),
  serverClose: vi.fn(() => Promise.resolve()),
  serverCtorArgs: [] as Array<{ port: number; host: string }>,
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
    constructor(port: number, host: string, cb?: () => void) {
      mocks.serverCtorArgs.push({ port, host });
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

import { OscTransport, listenHostFor } from "../../src/connection/OscTransport";

describe("listenHostFor", () => {
  it("binds loopback for local hosts", () => {
    expect(listenHostFor("127.0.0.1")).toBe("127.0.0.1");
    expect(listenHostFor("localhost")).toBe("127.0.0.1");
  });

  it("binds all interfaces for remote hosts", () => {
    expect(listenHostFor("192.168.1.20")).toBe("0.0.0.0");
  });
});

describe("OscTransport.request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.serverCtorArgs.length = 0;
    serverMessageCb = undefined;
  });

  function makeTransport(host = "127.0.0.1") {
    return new OscTransport({
      host,
      sendPort: 4557,
      listenPort: 4558,
      token: 42,
    });
  }

  it("binds the listen server to a local interface for remote hosts", async () => {
    const transport = makeTransport("10.0.0.5");
    await transport.open();
    expect(mocks.serverCtorArgs[0].host).toBe("0.0.0.0");
    await transport.dispose();
  });

  it("resolves with the reply message", async () => {
    const transport = makeTransport();
    await transport.open();

    mocks.clientSend.mockImplementation((address: string, ..._args: any[]) => {
      if (address === "/ping") {
        setTimeout(() => serverMessageCb?.(["/ack", "ok"]), 5);
      }
      return Promise.resolve();
    });

    const reply = await transport.request("/ping", "/ack", 1000, "id-1");
    expect(reply).toEqual({ address: "/ack", args: ["ok"] });

    await transport.dispose();
  });

  it("prepends the token to the outgoing request", async () => {
    const transport = makeTransport();
    await transport.open();

    mocks.clientSend.mockImplementation((address: string, ..._args: any[]) => {
      if (address === "/ping") {
        setTimeout(() => serverMessageCb?.(["/ack"]), 5);
      }
      return Promise.resolve();
    });

    await transport.request("/ping", "/ack", 1000, "id-2");
    expect(mocks.clientSend).toHaveBeenCalledWith("/ping", 42, "id-2");

    await transport.dispose();
  });

  it("resolves undefined on timeout", async () => {
    const transport = makeTransport();
    await transport.open();

    const reply = await transport.request("/ping", "/ack", 20);
    expect(reply).toBeUndefined();

    await transport.dispose();
  });

  it("resolves undefined when the send fails", async () => {
    const transport = makeTransport();
    await transport.open();

    mocks.clientSend.mockImplementation(() =>
      Promise.reject(new Error("network down"))
    );

    const reply = await transport.request("/ping", "/ack", 1000);
    expect(reply).toBeUndefined();

    await transport.dispose();
  });
});
