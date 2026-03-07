import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  close: vi.fn(() => Promise.resolve()),
  on: vi.fn(),
}));

vi.mock("node-osc", () => {
  class MockClient {
    send = mocks.send;
    close = mocks.close;
    on = mocks.on;
    constructor(..._args: any[]) {}
  }
  return { Client: MockClient, default: { Client: MockClient } };
});

import { Heartbeat } from "../../src/connection/Heartbeat";

describe("Heartbeat", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends keep-alive immediately on start", () => {
    const hb = new Heartbeat("127.0.0.1", 4560, 12345, 2000);
    hb.start();

    expect(mocks.send).toHaveBeenCalledWith("/daemon/keep-alive", 12345);
    hb.dispose();
  });

  it("sends keep-alive on each interval", () => {
    const hb = new Heartbeat("127.0.0.1", 4560, 12345, 2000);
    hb.start();

    mocks.send.mockClear();
    vi.advanceTimersByTime(2000);
    expect(mocks.send).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2000);
    expect(mocks.send).toHaveBeenCalledTimes(2);

    hb.dispose();
  });

  it("stops sending after stop()", () => {
    const hb = new Heartbeat("127.0.0.1", 4560, 12345, 2000);
    hb.start();

    hb.stop();
    mocks.send.mockClear();
    vi.advanceTimersByTime(10000);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("does not double-start", () => {
    const hb = new Heartbeat("127.0.0.1", 4560, 12345, 2000);
    hb.start();
    const firstClient = (hb as any)._client;
    hb.start();
    expect((hb as any)._client).toBe(firstClient);
    hb.dispose();
  });
});
