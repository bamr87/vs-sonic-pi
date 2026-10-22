// docs/reference/*.md is generated from package.json `contributes`; this fails
// `npm test` when a command, setting or keybinding changes without the
// reference being regenerated (`npm run docs:reference`).
import { describe, it, expect } from "vitest";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const root = fileURLToPath(new URL("../..", import.meta.url));

describe("generated reference docs", () => {
  it("docs/reference matches package.json contributes", () => {
    const run = spawnSync(process.execPath, ["scripts/gen-reference-docs.mjs", "--check"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
  });
});
