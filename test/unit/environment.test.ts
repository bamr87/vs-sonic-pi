import { describe, it, expect } from "vitest";
import { detectEnvironment } from "../../src/config/environment";

describe("detectEnvironment", () => {
  it("detects Codespaces and reads stream port", () => {
    const prevCodespaces = process.env.CODESPACES;
    const prevCodespaceName = process.env.CODESPACE_NAME;
    const prevPort = process.env.AUDIO_STREAM_PORT;

    try {
      process.env.CODESPACES = "true";
      process.env.CODESPACE_NAME = "unit-test-space";
      process.env.AUDIO_STREAM_PORT = "9090";

      const env = detectEnvironment();

      expect(env.isCodespace).toBe(true);
      expect(env.isRemoteContainer).toBe(true);
      expect(env.codespaceName).toBe("unit-test-space");
      expect(env.audioStreamPort).toBe(9090);
    } finally {
      if (prevCodespaces === undefined) {
        delete process.env.CODESPACES;
      } else {
        process.env.CODESPACES = prevCodespaces;
      }

      if (prevCodespaceName === undefined) {
        delete process.env.CODESPACE_NAME;
      } else {
        process.env.CODESPACE_NAME = prevCodespaceName;
      }

      if (prevPort === undefined) {
        delete process.env.AUDIO_STREAM_PORT;
      } else {
        process.env.AUDIO_STREAM_PORT = prevPort;
      }
    }
  });

  it("defaults stream port to 8080 when missing or invalid", () => {
    const prevPort = process.env.AUDIO_STREAM_PORT;

    try {
      delete process.env.AUDIO_STREAM_PORT;
      expect(detectEnvironment().audioStreamPort).toBe(8080);

      process.env.AUDIO_STREAM_PORT = "not-a-number";
      expect(detectEnvironment().audioStreamPort).toBe(8080);
    } finally {
      if (prevPort === undefined) {
        delete process.env.AUDIO_STREAM_PORT;
      } else {
        process.env.AUDIO_STREAM_PORT = prevPort;
      }
    }
  });
});
