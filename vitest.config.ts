import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/unit/**/*.test.ts", "test/integration/**/*.test.ts"],
    globals: true,
    mockReset: true,
  },
  resolve: {
    alias: {
      vscode: new URL("./test/__mocks__/vscode.ts", import.meta.url).pathname,
    },
  },
});
