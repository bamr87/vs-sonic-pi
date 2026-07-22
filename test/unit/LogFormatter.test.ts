import { describe, it, expect } from "vitest";
import {
  levelForMessageType,
  formatMultiMessage,
  formatError,
} from "../../src/log/LogFormatter";

describe("levelForMessageType", () => {
  it("maps normal output to info", () => {
    expect(levelForMessageType(0)).toBe("info");
    expect(levelForMessageType(2)).toBe("info");
    expect(levelForMessageType(3)).toBe("info");
  });

  it("maps type 4 to warning and 5 to error", () => {
    expect(levelForMessageType(4)).toBe("warning");
    expect(levelForMessageType(5)).toBe("error");
  });

  it("maps type 6 to debug", () => {
    expect(levelForMessageType(6)).toBe("debug");
  });

  it("defaults unknown types to info", () => {
    expect(levelForMessageType(99)).toBe("info");
  });
});

describe("formatMultiMessage", () => {
  it("includes thread name and per-type prefixes", () => {
    const out = formatMultiMessage("live_loop :beat", "12.5", [
      { type: 0, content: "synth :beep" },
      { type: 2, content: "cue :tick" },
    ]);
    expect(out).toContain("live_loop :beat");
    expect(out).toContain("=> synth :beep");
    expect(out).toContain("[cue] cue :tick");
  });
});

describe("formatError", () => {
  it("includes description, line, and backtrace", () => {
    const out = formatError("undefined method", "a.rb:1", 4);
    expect(out).toContain("undefined method");
    expect(out).toContain("(line 4)");
    expect(out).toContain("a.rb:1");
  });

  it("omits backtrace section when empty", () => {
    expect(formatError("boom", "", 1)).not.toContain("Backtrace");
  });
});
