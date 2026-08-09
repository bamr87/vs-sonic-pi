import { describe, it, expect } from "vitest";
import { findLiveLoops } from "../../src/language/LiveLoopLens";

describe("findLiveLoops", () => {
  it("finds a single live_loop block", () => {
    const text = [
      "use_bpm 120",
      "live_loop :beat do",
      "  sample :bd_haus",
      "  sleep 1",
      "end",
    ].join("\n");

    expect(findLiveLoops(text)).toEqual([
      { name: "beat", startLine: 1, endLine: 4 },
    ]);
  });

  it("finds multiple loops", () => {
    const text = [
      "live_loop :a do",
      "  sleep 1",
      "end",
      "",
      "live_loop :b do",
      "  sleep 0.5",
      "end",
    ].join("\n");

    const loops = findLiveLoops(text);
    expect(loops.map((l) => l.name)).toEqual(["a", "b"]);
    expect(loops[1]).toEqual({ name: "b", startLine: 4, endLine: 6 });
  });

  it("handles nested do/end blocks", () => {
    const text = [
      "live_loop :nested do",
      "  with_fx :reverb do",
      "    3.times do",
      "      play 60",
      "    end",
      "  end",
      "  sleep 1",
      "end",
    ].join("\n");

    expect(findLiveLoops(text)).toEqual([
      { name: "nested", startLine: 0, endLine: 7 },
    ]);
  });

  it("handles nested if/end blocks", () => {
    const text = [
      "live_loop :cond do",
      "  if one_in(2)",
      "    play 60",
      "  end",
      "  sleep 1",
      "end",
    ].join("\n");

    expect(findLiveLoops(text)).toEqual([
      { name: "cond", startLine: 0, endLine: 5 },
    ]);
  });

  it("ignores do/end inside strings and comments", () => {
    const text = [
      'live_loop :tricky do',
      '  puts "do not end here"',
      "  # end of nothing, do nothing",
      "  sleep 1",
      "end",
    ].join("\n");

    expect(findLiveLoops(text)).toEqual([
      { name: "tricky", startLine: 0, endLine: 4 },
    ]);
  });

  it("extends unclosed loops to the last line", () => {
    const text = ["live_loop :open do", "  sleep 1"].join("\n");

    expect(findLiveLoops(text)).toEqual([
      { name: "open", startLine: 0, endLine: 1 },
    ]);
  });

  it("supports sync option on the loop line", () => {
    const text = [
      "live_loop :melody, sync: :beat do",
      "  play 60",
      "  sleep 1",
      "end",
    ].join("\n");

    expect(findLiveLoops(text)[0].name).toBe("melody");
  });

  it("returns empty for text without loops", () => {
    expect(findLiveLoops("play 60\nsleep 1")).toEqual([]);
  });
});
