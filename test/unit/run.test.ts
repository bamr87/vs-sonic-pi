import { describe, it, expect } from "vitest";
import { bufferIdForDocument } from "../../src/commands/run";

describe("bufferIdForDocument", () => {
  it("is stable for the same document", () => {
    const a = bufferIdForDocument("file:///tmp/loop.spi");
    const b = bufferIdForDocument("file:///tmp/loop.spi");
    expect(a).toBe(b);
  });

  it("differs between documents", () => {
    const a = bufferIdForDocument("file:///tmp/loop.spi");
    const b = bufferIdForDocument("file:///tmp/other.spi");
    expect(a).not.toBe(b);
  });

  it("produces an OSC-safe identifier", () => {
    const id = bufferIdForDocument("untitled:Untitled-1");
    expect(id).toMatch(/^vscode-[a-z0-9]+$/);
  });
});
