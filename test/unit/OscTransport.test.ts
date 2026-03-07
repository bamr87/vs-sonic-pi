import { describe, it, expect, vi, beforeEach } from "vitest";

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

import { OscTransport } from "../../src/connection/OscTransport";

describe("OscTransport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverMessageCb = undefined;
  });

  it("opens and sets isOpen to true", async () => {
    const transport = new OscTransport({
      host: "127.0.0.1",
      sendPort: 4557,
      listenPort: 4558,
      token: 12345,
    });

    await transport.open();
    expect(transport.isOpen).toBe(true);
    await transport.dispose();
  });

  it("prepends token to send()", async () => {
    const transport = new OscTransport({
      host: "127.0.0.1",
      sendPort: 4557,
      listenPort: 4558,
      token: 42,
    });

    await transport.open();
    await transport.send("/ping", "hello");

    expect(mocks.clientSend).toHaveBeenCalledWith("/ping", 42, "hello");
    await transport.dispose();
  });

  it("sendRaw() does not prepend token", async () => {
    const transport = new OscTransport({
      host: "127.0.0.1",
      sendPort: 4557,
      listenPort: 4558,
      token: 42,
    });

    await transport.open();
    await transport.sendRaw("/daemon/keep-alive", 42);

    expect(mocks.clientSend).toHaveBeenCalledWith("/daemon/keep-alive", 42);
    await transport.dispose();
  });

  it("dispatches messages to registered handlers", async () => {
    const transport = new OscTransport({
      host: "127.0.0.1",
      sendPort: 4557,
      listenPort: 4558,
      token: 42,
    });

    await transport.open();

    const handler = vi.fn();
    transport.onMessage("/ack", handler);

    serverMessageCb?.(["/ack", "ok"]);

    expect(handler).toHaveBeenCalledWith({
      address: "/ack",
      args: ["ok"],
    });

    await transport.dispose();
  });

  it("dispatches to global handlers", async () => {
    const transport = new OscTransport({
      host: "127.0.0.1",
      sendPort: 4557,
      listenPort: 4558,
      token: 42,
    });

    await transport.open();

    const handler = vi.fn();
    transport.onAnyMessage(handler);

    serverMessageCb?.(["/log/info", "test"]);

    expect(handler).toHaveBeenCalledWith({
      address: "/log/info",
      args: ["test"],
    });

    await transport.dispose();
  });

  it("throws when sending on closed transport", async () => {
    const transport = new OscTransport({
      host: "127.0.0.1",
      sendPort: 4557,
      listenPort: 4558,
      token: 42,
    });

    await expect(transport.send("/ping")).rejects.toThrow(
      "OscTransport is not open"
    );
  });

  it("handler disposable removes handler", async () => {
    const transport = new OscTransport({
      host: "127.0.0.1",
      sendPort: 4557,
      listenPort: 4558,
      token: 42,
    });

    await transport.open();

    const handler = vi.fn();
    const disposable = transport.onMessage("/ack", handler);
    disposable.dispose();

    serverMessageCb?.(["/ack", "ok"]);
    expect(handler).not.toHaveBeenCalled();

    await transport.dispose();
  });
});
