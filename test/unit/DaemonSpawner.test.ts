import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir, platform } from "os";
import { join } from "path";
import { describe, it, expect, afterEach } from "vitest";
import { findRubyForDaemon } from "../../src/connection/DaemonSpawner";

const tempDirs: string[] = [];

function makeInstall(withBundledRuby: boolean): {
  root: string;
  daemonRb: string;
} {
  const root = mkdtempSync(join(tmpdir(), "sonic-pi-test-"));
  tempDirs.push(root);

  const daemonDir = join(root, "app", "server", "ruby", "bin");
  mkdirSync(daemonDir, { recursive: true });
  const daemonRb = join(daemonDir, "daemon.rb");
  writeFileSync(daemonRb, "# daemon");

  if (withBundledRuby) {
    const rubyDir = join(root, "app", "server", "native", "ruby", "bin");
    mkdirSync(rubyDir, { recursive: true });
    const exe = platform() === "win32" ? "ruby.exe" : "ruby";
    writeFileSync(join(rubyDir, exe), "#!/bin/sh");
  }

  return { root, daemonRb };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("findRubyForDaemon", () => {
  it("prefers the bundled ruby next to daemon.rb", () => {
    const { root, daemonRb } = makeInstall(true);
    const exe = platform() === "win32" ? "ruby.exe" : "ruby";
    expect(findRubyForDaemon(daemonRb)).toBe(
      join(root, "app", "server", "native", "ruby", "bin", exe)
    );
  });

  it("falls back to system ruby when no bundled interpreter exists", () => {
    const { daemonRb } = makeInstall(false);
    expect(findRubyForDaemon(daemonRb)).toBe("ruby");
  });

  it("falls back to system ruby for unrecognized paths", () => {
    expect(findRubyForDaemon("/weird/place/daemon.rb")).toBe("ruby");
  });
});
