# Changelog

All notable changes to the **Sonic Pi for VS Code** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **GitHub Codespaces support** — devcontainer with Sonic Pi server, SuperCollider, PulseAudio/JACK audio stack, and ffmpeg HTTP audio streaming
- **Audio stream webview** — `Sonic Pi: Listen (Audio Stream)` command and Controls sidebar entry for hearing output in headless environments
- **Environment detection** — auto-detect Codespaces and remote containers via environment variables (`SONIC_PI_HOME`, `AUDIO_STREAM_PORT`)
- **Copilot agent and prompt templates** — contributor agent, contribution workflow instructions, and reusable prompt files

### Changed

- Port discovery now uses a saved `port-info` file instead of parsing `spider.log`
- `DaemonSpawner` checks `SONIC_PI_HOME` environment variable for daemon path
- `ConnectionManager` tries existing port-info file before spawning a new daemon
- Extension declared as `extensionKind: ["workspace"]` for remote support
- Added `docs/10-codespaces-support.md` architecture documentation for remote runtime and streaming

### Fixed

- Mario Overworld example timing: all loops now align to 24 beats (6 bars of 4/4)
- Tests mock `findDaemonPath` to prevent side effects from host Sonic Pi installs
- Audio stream webview now applies CSP + nonce script policy and validates stream port values
- Connection recovery now clears stale `port-info` and retries with fresh discovery when initial ping fails

## [0.1.0] - 2026-03-05

### Added

- **Syntax highlighting** for `.spi` and `.sonicpi` files with full TextMate grammar
- **IntelliSense** autocompletion for synths, samples, FX, scales, chords, notes, options, and functions
- **Hover documentation** with rich details for all Sonic Pi language elements
- **Run/Stop** commands with F5/Shift+F5 keybindings
- **Run Selection** to execute only selected code (Ctrl+F5 / Cmd+F5)
- **OSC transport** layer with automatic port discovery and authentication
- **Connection management** with auto-connect, heartbeat, and status bar indicator
- **Diagnostics** integration — Sonic Pi errors appear in the Problems panel
- **Log output** channel for Sonic Pi messages with configurable log levels
- **31 code snippets** for common Sonic Pi patterns
- **55 bundled examples** organized by difficulty level
- **85-chapter tutorial** from the official Sonic Pi documentation with sidebar tree view and webview reader
- **Beautify Buffer** command for auto-formatting code
- **Audio recording** commands (start, stop, save as WAV)
- **Extension icon** from the official Sonic Pi project
- **Getting Started walkthrough** for new users
- **150 scales**, **70 chords**, and **153 notes** in the data layer for completions and hover
- **8 configurable settings** for connection, logging, and paths
