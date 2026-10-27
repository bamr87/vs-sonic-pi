# Sonic Pi for VS Code

> VS Code extension to write and perform Sonic Pi music live: IntelliSense, hover docs, built-in tutorial, OSC control.

[![CI](https://github.com/bamr87/vs-sonic-pi/actions/workflows/ci.yml/badge.svg)](https://github.com/bamr87/vs-sonic-pi/actions/workflows/ci.yml) [![License](https://img.shields.io/github/license/bamr87/vs-sonic-pi)](LICENSE)

## Overview

**Code. Music. Live.** — Write and perform [Sonic Pi](https://sonic-pi.net) music directly from VS Code.

## Features

### Syntax Highlighting & IntelliSense

Full language support for `.spi` files with context-aware autocompletion for **43 synths**, **96 samples**, **34 FX**, **150 scales**, **70 chords**, and **163 functions**.

### Run & Stop with Keybindings

Press **F5** to run your code, **Shift+F5** to stop. Run just a selection with **Ctrl+F5** (Cmd+F5 on macOS).

### Rich Hover Documentation

Hover over any synth, sample, FX, scale, chord, note, or function to see detailed documentation with options tables and code examples.

### Built-in Tutorial

The complete **85-chapter Sonic Pi tutorial** is built right into the extension. Browse chapters in the sidebar tree view or read them in a styled webview panel.

### Live Connection to Sonic Pi

Connects to a running Sonic Pi instance over OSC with automatic port discovery, authentication, and heartbeat keep-alive. The status bar shows your connection state at a glance.

### Error Diagnostics

Sonic Pi runtime errors and syntax errors appear inline in the editor and in the Problems panel — no need to switch windows.

### 55 Bundled Examples

Browse and open examples organized by difficulty: Apprentice, Illusionist, Magician, and Wizard.

### Audio Recording

Start, stop, and save audio recordings as WAV files — all from within VS Code.

### Code Snippets

31 snippets for common patterns like `live_loop`, `with_fx`, `play`, `sample`, and more.

## Quick start

1. **Install Sonic Pi** from [sonic-pi.net](https://sonic-pi.net)
2. **Open Sonic Pi** (the application must be running)
3. **Create a `.spi` file** in VS Code
4. **Write some code:**
   ```ruby
   live_loop :beat do
     sample :drum_bass_hard
     sleep 0.5
   end
   ```
5. **Press F5** to hear your music!

The extension auto-connects to Sonic Pi when you open a `.spi` file.

To build and run the extension from a clone, use the same commands as [AGENTS.md](AGENTS.md#stack--commands):

```bash
npm install                  # install dependencies (Node >= 20; CI runs npm ci on Node 20 and 22)
npm run build                # esbuild bundle → dist/extension.js; then F5 ("Run Extension") opens the Extension Development Host
npm run watch                # rebuild on change
npm run lint                 # eslint src/
npm test                     # vitest run: unit + integration, plus the docs/reference freshness check
npm run test:watch           # vitest in watch mode
npm run docs:reference       # regenerate docs/reference/*.md from package.json contributes
npm run package              # vsce package → .vsix (needs @vscode/vsce on PATH, as release.yml installs it)
SONIC_PI_PATH=/path/to/sonic-pi npm run extract-data   # regenerate src/data/sonic-pi-data.json from a Sonic Pi checkout
SONIC_PI_PATH=/path/to/sonic-pi npm run copy-tutorial  # refresh media/tutorial/ from a Sonic Pi checkout
```

## Requirements

- **VS Code** 1.109+
- **Sonic Pi** v4.x running on the same machine (or use GitHub Codespaces — see below)

## Commands, settings and keybindings

Open the Command Palette (`Ctrl+Shift+P`) and type "Sonic Pi" to see every command. The ones you will use most:

- **Run** (`F5`), **Run Selection** (`Ctrl+F5` / `Cmd+F5`) and **Stop** (`Shift+F5`), in `.spi` files.
- **New Loop File** — opens a ready-to-run starter file with two synced live loops.
- **Connect** / **Disconnect**, **Open Tutorial** / **Open Examples**, **Beautify Buffer**, **Open Log**, and **Start** / **Stop** / **Save Recording**.

Every `live_loop` in a `.spi` file also gets a **▶ Run loop** CodeLens above it: click it to send just that loop to Sonic Pi — tweak one loop and re-send it while the rest of your music keeps playing.

The settings you are most likely to change are `sonicpi.autoConnect`, the `sonicpi.osc.*` host and ports, `sonicpi.sonicPiPath` and `sonicpi.logLevel`. The full lists are generated from `package.json`: [commands](docs/reference/commands.md), [settings](docs/reference/settings.md) and [keybindings](docs/reference/keybindings.md). The [User Manual](docs/user-manual.md) has configuration examples.

## Tutorial

The extension includes the complete Sonic Pi tutorial:

1. Click the **Sonic Pi** icon in the Activity Bar
2. Browse chapters in the tree view
3. Click a chapter to read it in a styled webview

Topics covered: synths, samples, FX, randomisation, programming structures, live coding, data structures, state, MIDI, OSC, multichannel audio, and more.

## GitHub Codespaces

You can use this extension entirely in the cloud with [GitHub Codespaces](https://github.com/features/codespaces) — no local Sonic Pi installation required. The included devcontainer builds a full Sonic Pi server (Ruby daemon, SuperCollider, audio stack) inside the container.

### Getting Started in Codespaces

1. Open this repository on GitHub
2. Click **Code > Codespaces > Create codespace on main**
3. Wait for the container to build (first time takes ~5-10 minutes; subsequent starts are instant)
4. Create a `.spi` file and start coding — the extension auto-connects to the Sonic Pi server

### Audio Output

Since Codespaces run in headless containers with no speakers, audio is streamed over HTTP:

- On first connect, a notification offers to open the **audio stream player**
- You can also run **Sonic Pi: Listen (Audio Stream)** from the Command Palette or the Controls sidebar
- The player opens a webview that streams MP3 audio from the container via PulseAudio + ffmpeg
- Alternatively, open the forwarded port (8080) directly in your browser

### How It Works

The devcontainer installs:
- **PulseAudio** with a virtual null sink (no hardware needed)
- **JACK** with a dummy audio driver
- **SuperCollider server** (scsynth) for sound synthesis
- **Sonic Pi server** built from source (Ruby daemon + Tau/Erlang)
- **ffmpeg** to encode and stream audio over HTTP

The extension detects the Codespace environment automatically and configures the Sonic Pi path, audio stream port, and connection settings.

### Known Limitations

- **Audio latency**: Expect 200-500ms delay between running code and hearing sound. This is fine for composition but not ideal for live performance.
- **No MIDI**: MIDI input/output is not available in Codespaces.
- **Container size**: The full audio stack makes the container ~2-3 GB. Use Codespace prebuilds to avoid rebuilding on every start.
- **First build time**: Initial container creation takes 5-10 minutes due to building Sonic Pi from source.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SONIC_PI_HOME` | `/opt/sonic-pi` | Path to Sonic Pi installation |
| `AUDIO_STREAM_PORT` | `8080` | HTTP port for audio streaming |
| `AUDIO_STREAM_ENABLED` | `true` | Set to `false` to disable audio streaming |

## Acknowledgments

- [Sonic Pi](https://sonic-pi.net) by Sam Aaron — the live coding music synthesizer that makes this extension possible
- The Sonic Pi community for the incredible documentation and examples

## Documentation

The [documentation index](docs/README.md) lists every document in the repository: the [User Manual](docs/user-manual.md) for using the extension, the [architecture overview](docs/00-architecture.md) and numbered component designs for working on it, the generated reference above, and the [PRD](docs/PRD.md).

## Project structure

| Path | What it is |
|---|---|
| `src/` | Extension source (TypeScript) |
| `syntaxes/`, `language-configuration.json` | Sonic Pi grammar and editor behaviour |
| `media/tutorial/`, `images/` | Built-in tutorial content and assets |
| `examples/` | Sample `.spi` files |
| `test/` | Vitest suites |
| `docs/` | User manual, architecture and component designs, generated reference |
| `scripts/`, `tools/` | Data, tutorial and reference generators; vendored fleet doc tools |
| `.devcontainer/` | The Codespaces image with a headless Sonic Pi server and audio stream |

## Development

The build, lint and test commands are the [Quick start](#quick-start) block; [AGENTS.md](AGENTS.md) is the canonical guide to working here (module rules, conventions, what is generated) and [CONTRIBUTING.md](CONTRIBUTING.md) covers local setup and the pull request process.

## Contributing

Contributions are welcome — read [CONTRIBUTING.md](CONTRIBUTING.md), then open an issue or pull request on [GitHub](https://github.com/bamr87/vs-sonic-pi). AI agents should start with [AGENTS.md](AGENTS.md). The fleet-wide workflow is described in the hub's [CONTRIBUTING.md](https://github.com/bamr87/bamr87/blob/main/CONTRIBUTING.md).

## Changelog

Notable changes are recorded in [CHANGELOG.md](CHANGELOG.md), kept by hand in Keep a Changelog format.

## License

This extension is licensed under the [MIT License](LICENSE).

Tutorial content is derived from the [Sonic Pi](https://sonic-pi.net) project by Sam Aaron, licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

---

<!-- bamr87-portfolio-footer -->
Part of the [bamr87 portfolio](https://github.com/bamr87) — browse every project on [Amr's GitHub profile](https://github.com/bamr87).
