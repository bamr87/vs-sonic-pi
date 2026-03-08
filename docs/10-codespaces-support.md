# 10. Codespaces Support and Remote Audio Streaming

## Purpose

This module group enables running the extension in GitHub Codespaces where no local audio hardware is available. It provides:

- Environment detection for remote/container sessions
- A headless audio stack inside the devcontainer
- HTTP audio streaming to a VS Code webview player
- Port persistence and stale-port recovery for reconnect reliability

## Components

### `src/config/environment.ts`

`detectEnvironment()` reads environment variables and returns typed runtime context:

- `isCodespace`
- `isRemoteContainer`
- `codespaceName`
- `sonicPiHome`
- `audioStreamPort`

The audio stream port is validated to a safe integer (`1..65535`) with fallback to `8080`.

### `src/ui/AudioStreamWebview.ts`

Creates the `Sonic Pi — Audio Stream` webview panel used by the command `sonicpi.openAudioStream`.

Key details:

- Uses secure Content Security Policy (CSP)
- Uses nonce-based script execution
- Sanitizes stream port before URL construction
- Streams from `http://localhost:<port>`

### Connection fallback behavior

`ConnectionManager` now attempts persisted `port-info` first. If ping fails:

1. Clear persisted `port-info`
2. Retry via daemon spawn (if available)
3. Fallback to config/default ports

This avoids repeated failures caused by stale port files.

## Devcontainer Runtime

`.devcontainer/` provides the full runtime:

- `Dockerfile`: builds Sonic Pi server and dependencies
- `pulse-default.pa`: headless PulseAudio null sink
- `start-audio.sh`: starts PulseAudio, JACK dummy backend, and ffmpeg stream
- `devcontainer.json`: forwards audio stream port and sets remote env vars

Security and runtime defaults:

- ffmpeg HTTP listener bound to `127.0.0.1`
- Sonic Pi runtime dir permissions set to `775`

## User Flow

1. User opens repository in Codespaces
2. Devcontainer starts audio subsystem
3. Extension auto-connects to Sonic Pi
4. On first connect in Codespaces, extension offers to open the audio stream
5. User listens via webview or forwarded port

## Operational Notes

- Network latency is expected for streamed audio
- MIDI is not available in Codespaces
- Initial container build is heavier than local-only development
