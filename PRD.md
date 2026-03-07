# Product Requirements Document: Sonic Pi VS Code Extension

**Version:** 2.0  
**Status:** Draft  
**Last Updated:** March 2025  
**Reference:** [Sonic Pi](https://github.com/sonic-pi-net/sonic-pi) — Code. Music. Live.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Vision & Goals](#2-vision--goals)
3. [User Personas](#3-user-personas)
4. [Product Overview](#4-product-overview)
5. [Functional Requirements](#5-functional-requirements)
6. [Architectural Design](#6-architectural-design)
7. [Module Specifications](#7-module-specifications)
8. [Data Models & Schemas](#8-data-models--schemas)
9. [Extension File & Directory Layout](#9-extension-file--directory-layout)
10. [User Experience](#10-user-experience)
11. [Phased Delivery Plan](#11-phased-delivery-plan)
12. [Testing Strategy](#12-testing-strategy)
13. [Success Metrics](#13-success-metrics)
14. [Risks & Mitigations](#14-risks--mitigations)
15. [References & Prior Art](#15-references--prior-art)
16. [Document History](#16-document-history)

---

## 1. Executive Summary

Build a **VS Code extension** that provides a first-class Sonic Pi experience inside Visual Studio Code, equivalent in capability to the native Sonic Pi GUI for writing, running, and live-coding music. The extension communicates with the existing Sonic Pi server (Ruby + SuperCollider) via its OSC API so users can code in VS Code while retaining full compatibility with Sonic Pi's language, synths, samples, and live loops.

---

## 2. Vision & Goals

### 2.1 Vision

*Code. Music. Live.* — Users should be able to create and perform music with Sonic Pi's Ruby DSL entirely from VS Code, with the same simplicity, joy, and power as the standalone app.

### 2.2 Goals

| Goal | Description |
|------|-------------|
| **Parity** | Match or exceed the native Sonic Pi GUI for core workflows: run code, stop, see logs, and live-edit loops. |
| **Integration** | Feel like a natural part of VS Code (commands, keybindings, panels, settings). |
| **Compatibility** | Work with installed Sonic Pi (v4.x+) on Windows, macOS, and Linux. No forking of the Sonic Pi runtime. |
| **Education & performance** | Support both learning (tutorials, examples, feedback) and live performance (low latency, reliable run/stop). |

### 2.3 Non-Goals (Out of Scope)

- Reimplementing the Sonic Pi server or audio engine in the extension.
- Replacing or bundling Sonic Pi; the desktop app remains the required backend.
- Building a full in-editor replacement for Sonic Pi's built-in tutorial UI (link to external tutorial is acceptable).
- Supporting Sonic Pi versions before v4.x in the first release.

---

## 3. User Personas

| Persona | Need |
|---------|------|
| **Educator / student** | Simple run/stop, clear error messages, access to examples and tutorials, works in a lab/classroom. |
| **Live coder / artist** | Fast run/stop, visible log/cues, reliable connection to Sonic Pi, optional recording. |
| **Developer** | Use VS Code for all coding; prefer one editor with syntax support, run shortcut, and log panel. |

---

## 4. Product Overview

### 4.1 What Is Sonic Pi?

Sonic Pi is an open-source live coding environment where users write **Ruby-based DSL code** to make music. Core concepts:

- **`play`** / **`use_synth`** — trigger synths (e.g. `play 60`, `use_synth :prophet`).
- **`sample`** — play built-in samples (e.g. `sample :bd_haus`).
- **`live_loop`** — named loops that run concurrently and can be updated while running (live coding).
- **`sleep`** — timing between events.
- **Cues, MIDI, OSC** — integration with external tools and timing.

### 4.2 Sonic Pi Internal Architecture (v4.x)

Understanding Sonic Pi's own architecture is critical because the extension replaces the GUI layer.

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Sonic Pi Application                               │
│                                                                      │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌────────┐ │
│  │   GUI    │◄──►│  Boot Daemon │◄──►│ Tau (BEAM/   │◄──►│scsynth │ │
│  │  (Qt/C++)│    │  (daemon.rb) │    │  Erlang)     │    │(Super- │ │
│  │          │    │              │    │              │    │Collider│ │
│  │          │    │  Spawns all  │    │ Routes OSC   │    │        │ │
│  │  Editor  │    │  processes   │    │ messages     │    │ Audio  │ │
│  │  Log     │    │  Discovers   │    │              │    │ synth  │ │
│  │  Prefs   │    │  ports       │    │ ┌──────────┐ │    │ engine │ │
│  │  Tutorial│    │  Outputs     │    │ │  Spider  │ │    │        │ │
│  │          │    │  port map    │    │ │  Server  │ │    │        │ │
│  │          │    │  to STDOUT   │    │ │  (Ruby)  │ │    │        │ │
│  │          │    │              │    │ │          │ │    │        │ │
│  │          │    │              │    │ │ Executes │ │    │        │ │
│  │          │    │              │    │ │ user code│ │    │        │ │
│  │          │    │              │    │ └──────────┘ │    │        │ │
│  └──────────┘    └──────────────┘    └──────────────┘    └────────┘ │
│       ▲                                     ▲                       │
│       │          OSC (UDP)                  │                       │
│       └─────────────────────────────────────┘                       │
└──────────────────────────────────────────────────────────────────────┘
```

**Boot Daemon (`daemon.rb`)** — The entry point. Spawns the Tau/Erlang process and the Ruby Spider server. Discovers available ports and outputs a port map to STDOUT. Implements a **zombie kill switch**: if no `/daemon/keep-alive` OSC message is received within ~90 seconds, the daemon shuts down all child processes.

**Tau (BEAM/Erlang)** — The message router running on the Erlang VM. Routes OSC messages between the GUI, the Spider server, and scsynth. Manages the Phoenix web server (used for internal comms in newer versions).

**Spider Server (Ruby)** — The heart of Sonic Pi. Evaluates user code (`__spider_eval_code`), implements the DSL (`play`, `sample`, `live_loop`, etc.), manages threads, timing, and sends synth commands to scsynth via Tau.

**scsynth (SuperCollider)** — The audio synthesis engine. Receives synth/sample trigger messages and produces audio output.

### 4.3 Extension Role

The extension **replaces the Qt/C++ GUI** as the front-end. It becomes the editor, command dispatcher, and log viewer. Everything else (daemon, Tau, Spider, scsynth) remains unchanged.

```
┌──────────────────────────────────────────────────────────────────────┐
│                    VS Code + Extension                               │
│                    (replaces Qt GUI)                                  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │  Extension                                                       ││
│  │  • Editor with syntax / completion / hover                      ││
│  │  • Command palette (Run, Stop, Record, etc.)                    ││
│  │  • OSC transport layer (send commands, receive logs)            ││
│  │  • Keep-alive heartbeat to daemon                               ││
│  │  • Log panel (Output channel or Webview)                        ││
│  │  • Status bar (connection state)                                ││
│  └──────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────┘
        │                              ▲
        │  OSC / UDP                   │  OSC / UDP
        ▼                              │
┌──────────────────────────────────────────────────────────────────────┐
│  Sonic Pi Backend (unchanged)                                        │
│  daemon.rb → Tau (BEAM) → Spider Server (Ruby) → scsynth            │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 5. Functional Requirements

### 5.1 Must Have (MVP — Phase 1)

| ID | Requirement | Notes |
|----|-------------|--------|
| FR-1 | **Run code** | Send current file or selection to Sonic Pi via OSC `/run-code` or `/save-and-run-buffer`. |
| FR-2 | **Stop all** | Send `/stop-all-jobs` to stop all running threads. |
| FR-3 | **Log / output panel** | Listen for `/multi_message`, `/info`, `/error` and render in a VS Code Output channel. Preserve log types (info, warning, error, user message). |
| FR-4 | **Syntax highlighting** | TextMate grammar for Sonic Pi Ruby DSL. |
| FR-5 | **Server detection** | `/ping` → `/ack` handshake. Clear message if server not found. |
| FR-6 | **Keep-alive heartbeat** | Send `/daemon/keep-alive` every ~30 s to prevent the zombie kill switch from shutting down the daemon. |
| FR-7 | **Configuration** | Settings for OSC host/ports with sensible defaults. |
| FR-8 | **Run / Stop commands** | VS Code commands with keybindings (F5 = Run, Shift+F5 = Stop). |

### 5.2 Should Have (V1 — Phase 2)

| ID | Requirement | Notes |
|----|-------------|--------|
| FR-9 | **Autocomplete / IntelliSense** | Completions for synths, samples, FX, and DSL keywords from bundled JSON data. |
| FR-10 | **Hover documentation** | Short docs for core functions, synths, samples. |
| FR-11 | **Examples** | Command to open bundled example files. |
| FR-12 | **Run selection** | Run only highlighted code via `/run-code`. |
| FR-13 | **Error reporting** | Parse `/error` messages, extract line numbers, show in VS Code Problems panel and inline diagnostics. |
| FR-14 | **Status bar** | Show connection state ("Sonic Pi: Connected" / "Disconnected") and active run count. |
| FR-15 | **Daemon auto-start** | Optionally spawn `daemon.rb` from the extension if Sonic Pi is installed but not running. |

### 5.3 Nice to Have (Backlog — Phase 3)

| ID | Requirement | Notes |
|----|-------------|--------|
| FR-16 | **Recording** | Start/stop/save recording via OSC. |
| FR-17 | **Beautify / Align** | `/beautify-buffer` → `/replace-buffer` round-trip. |
| FR-18 | **Tutorial webview** | Embedded panel linking to sonic-pi.net/tutorial. |
| FR-19 | **Cue log** | Separate panel for incoming OSC cues. |
| FR-20 | **MIDI monitor** | Show MIDI in/out events. |
| FR-21 | **Audio scope** | Webview-based waveform/spectrum visualizer (stretch). |
| FR-22 | **Multi-buffer workspaces** | Map VS Code editor tabs to Sonic Pi workspace names. |

---

## 6. Architectural Design

### 6.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VS Code Host Process                           │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     Extension Host (Node.js)                          │  │
│  │                                                                       │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │  │
│  │  │  Extension   │  │  Language     │  │  OSC          │  │  Log      │ │  │
│  │  │  Core        │  │  Provider     │  │  Transport    │  │  Manager  │ │  │
│  │  │             │  │              │  │              │  │           │ │  │
│  │  │ • activate  │  │ • Grammar    │  │ • OscClient  │  │ • Output  │ │  │
│  │  │ • deactivate│  │ • Completion │  │ • OscServer  │  │   Channel │ │  │
│  │  │ • commands  │  │ • Hover      │  │ • Heartbeat  │  │ • Format  │ │  │
│  │  │ • config    │  │ • Diagnostics│  │ • Reconnect  │  │ • Filter  │ │  │
│  │  │ • lifecycle │  │ • Snippets   │  │              │  │ • Cue log │ │  │
│  │  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘ │  │
│  │         │                │                  │                │       │  │
│  │         └────────────────┴─────────┬────────┴────────────────┘       │  │
│  │                                    │                                  │  │
│  │                            ┌───────┴────────┐                        │  │
│  │                            │  Connection     │                        │  │
│  │                            │  Manager        │                        │  │
│  │                            │                 │                        │  │
│  │                            │ • State machine │                        │  │
│  │                            │ • Port discovery│                        │  │
│  │                            │ • Daemon spawn  │                        │  │
│  │                            │ • Health check  │                        │  │
│  │                            └────────┬────────┘                        │  │
│  └─────────────────────────────────────┼─────────────────────────────────┘  │
│                                        │                                    │
│  ┌─────────────────────────────────────┼─────────────────────────────────┐  │
│  │                     VS Code UI Layer│                                  │  │
│  │                                     │                                  │  │
│  │  ┌──────────┐  ┌──────────┐  ┌─────┴──────┐  ┌───────────────────┐   │  │
│  │  │  Editor   │  │ Problems │  │  Status    │  │  Output Channel   │   │  │
│  │  │  (syntax, │  │  Panel   │  │  Bar Item  │  │  "Sonic Pi Log"   │   │  │
│  │  │  complete)│  │          │  │            │  │                   │   │  │
│  │  └──────────┘  └──────────┘  └────────────┘  └───────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                              │ UDP :send-port
                              │ UDP :listen-port
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Sonic Pi Backend                                     │
│                                                                             │
│  ┌────────────┐     ┌────────────────┐     ┌────────────┐    ┌──────────┐  │
│  │  daemon.rb  │────►│  Tau (BEAM)    │────►│  Spider    │───►│ scsynth  │  │
│  │             │     │  OSC Router    │     │  Server    │    │ (audio)  │  │
│  │  Port map   │     │  Phoenix web   │     │  (Ruby)    │    │          │  │
│  │  Keep-alive │     │               │     │  Code eval │    │          │  │
│  └────────────┘     └────────────────┘     └────────────┘    └──────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Module Dependency Graph

```
extension.ts (entry point)
    │
    ├── ConnectionManager
    │       ├── OscTransport
    │       │       ├── OscClient  (sends to server)
    │       │       └── OscServer  (listens for responses)
    │       ├── DaemonSpawner (optional: start daemon.rb)
    │       └── Heartbeat (keep-alive timer)
    │
    ├── CommandHandler
    │       ├── RunCommand
    │       ├── StopCommand
    │       ├── RecordCommands
    │       └── BeautifyCommand
    │
    ├── LanguageProvider
    │       ├── SonicPiGrammar (TextMate .tmLanguage.json)
    │       ├── CompletionProvider
    │       ├── HoverProvider
    │       └── DiagnosticsProvider
    │
    ├── LogManager
    │       ├── OutputChannelRenderer
    │       ├── LogFormatter
    │       └── CueLog
    │
    ├── StatusBarManager
    │
    └── ConfigManager
```

### 6.3 Connection State Machine

The `ConnectionManager` is the most critical module. It governs the lifecycle of the connection to the Sonic Pi backend.

```
                    ┌──────────────┐
         ┌─────────│ Disconnected │◄──────────────────────┐
         │         └──────┬───────┘                       │
         │                │                               │
         │    user: "Run" or                    timeout / error /
         │    auto-connect on activate          server exited
         │                │                               │
         │                ▼                               │
         │         ┌──────────────┐                       │
         │         │  Connecting  │                       │
         │         │              │                       │
         │         │ • Discover   │                       │
         │         │   ports      │                       │
         │         │ • Bind OSC   │                       │
         │         │   listener   │                       │
         │         │ • Send /ping │                       │
         │         └──────┬───────┘                       │
         │                │                               │
         │          /ack received                         │
         │                │                               │
         │                ▼                               │
         │         ┌──────────────┐                       │
         │         │  Connected   │───────────────────────┘
         │         │              │
         │         │ • Heartbeat  │
         │         │   active     │
         │         │ • Commands   │
         │         │   enabled    │
         │         │ • Log stream │
         │         │   flowing    │
         │         └──────┬───────┘
         │                │
         │         user: deactivate
         │         or "Disconnect"
         │                │
         │                ▼
         │         ┌──────────────┐
         └────────►│ Disconnecting│
                   │              │
                   │ • Stop       │
                   │   heartbeat  │
                   │ • Close OSC  │
                   │   sockets    │
                   └──────────────┘
```

**States:**

| State | Description | Status Bar |
|-------|-------------|------------|
| `Disconnected` | No connection to Sonic Pi. Commands disabled except "Connect". | `$(circle-slash) Sonic Pi` |
| `Connecting` | Attempting handshake. Sends `/ping`, waits for `/ack`. Retries up to N times. | `$(sync~spin) Sonic Pi` |
| `Connected` | Active session. Heartbeat running. All commands enabled. | `$(check) Sonic Pi` |
| `Disconnecting` | Tearing down. Stops heartbeat, closes sockets. Transitions to `Disconnected`. | `$(sync~spin) Sonic Pi` |

### 6.4 OSC Message Flow (Sequence Diagrams)

#### 6.4.1 Run Code

```
  VS Code Extension                   Sonic Pi Server
  ─────────────────                   ────────────────
        │                                    │
        │  /save-and-run-buffer              │
        │  [filename, code, workspace]       │
        │───────────────────────────────────►│
        │                                    │
        │                                    │── evaluate code
        │                                    │
        │         /multi_message             │
        │  [run#, thread, ts, type, msg]     │
        │◄───────────────────────────────────│
        │                                    │
        │         /multi_message  ...        │
        │◄───────────────────────────────────│
        │                                    │
        │  (if error)  /error [msg]          │
        │◄───────────────────────────────────│
        │                                    │
```

#### 6.4.2 Stop All

```
  VS Code Extension                   Sonic Pi Server
  ─────────────────                   ────────────────
        │                                    │
        │  /stop-all-jobs                    │
        │───────────────────────────────────►│
        │                                    │
        │                                    │── kill threads
        │                                    │
```

#### 6.4.3 Keep-Alive Heartbeat

```
  VS Code Extension                   Sonic Pi Daemon
  ─────────────────                   ────────────────
        │                                    │
        │  /daemon/keep-alive                │
        │───────────────────────────────────►│  (every ~30s)
        │                                    │
        │  /daemon/keep-alive                │
        │───────────────────────────────────►│  (every ~30s)
        │                                    │
        │  ...                               │
        │                                    │
        │  (if missed for ~90s)              │
        │                              daemon kills all
        │                              child processes
```

#### 6.4.4 Connection Handshake

```
  VS Code Extension                   Sonic Pi Server
  ─────────────────                   ────────────────
        │                                    │
        │  /ping                             │
        │───────────────────────────────────►│
        │                                    │
        │         /ack                       │
        │◄───────────────────────────────────│
        │                                    │
        │  (Connected — start heartbeat)     │
        │                                    │
```

### 6.5 Port Discovery Strategy

Sonic Pi v4 uses dynamic port allocation. The daemon outputs a port map to STDOUT when it boots. The extension needs to discover these ports.

**Strategy (in priority order):**

1. **Read port file** — Sonic Pi writes port info to `~/.sonic-pi/log/` or a known location. Parse this file on connect.
2. **User configuration** — Allow manual override in VS Code settings for advanced users.
3. **Spawn daemon** — If the extension starts `daemon.rb` itself, capture STDOUT to read the port map directly.
4. **Default ports** — Fall back to well-known defaults (4557/4558) for older Sonic Pi versions or simple setups.

```typescript
interface PortMap {
  serverPort: number;     // extension sends commands here
  guiPort: number;        // extension listens on this port
  scsynthPort: number;    // (informational only)
  oscCuesPort: number;    // (informational only)
  daemonPort: number;     // for keep-alive messages
}
```

### 6.6 Technology Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Extension host | VS Code Extension API (TypeScript) | Standard, well-documented. |
| OSC library | `node-osc` (npm) + `@types/node-osc` | Mature, UDP send/receive, bundle support. |
| Language | TypeScript (strict mode) | Type safety, refactorability. |
| Grammar | TextMate grammar (`.tmLanguage.json`) | Native VS Code syntax highlighting. |
| Completion data | Bundled JSON (synths, samples, FX, opts) | No runtime dependency; version-pinned. |
| Build | esbuild or webpack | Fast bundling for extension distribution. |
| Test | Vitest + `@vscode/test-electron` | Unit tests + integration tests in VS Code. |
| Lint | ESLint + Prettier | Consistent code style. |
| Package | `vsce` (VS Code Extension CLI) | Standard packaging and publishing. |

---

## 7. Module Specifications

### 7.1 Extension Core (`extension.ts`)

**Responsibility:** Entry point. Registers commands, activates modules, manages lifecycle.

```typescript
// Activation events (package.json):
//   onLanguage:sonicpi
//   onCommand:sonicpi.run
//   onCommand:sonicpi.stop

export function activate(context: vscode.ExtensionContext): void {
  // 1. Initialize ConfigManager (read settings)
  // 2. Initialize ConnectionManager (but don't connect yet)
  // 3. Register commands (Run, Stop, Connect, Disconnect, etc.)
  // 4. Register LanguageProvider (grammar is static; completion/hover lazy)
  // 5. Initialize StatusBarManager
  // 6. Initialize LogManager
  // 7. Push all disposables to context.subscriptions
}

export function deactivate(): void {
  // 1. Stop heartbeat
  // 2. Close OSC sockets
  // 3. Dispose all resources
}
```

### 7.2 ConnectionManager

**Responsibility:** Owns the connection state machine, port discovery, and health monitoring.

| Method | Description |
|--------|-------------|
| `connect()` | Discover ports → bind listener → send `/ping` → wait for `/ack` → start heartbeat. |
| `disconnect()` | Stop heartbeat → close sockets → transition to Disconnected. |
| `getState()` | Return current `ConnectionState`. |
| `onStateChange` | Event emitter for state transitions (consumed by StatusBar, Commands). |

**Internal details:**
- Retry `/ping` up to 5 times with 1 s interval before giving up.
- On unexpected disconnect (no `/ack` to periodic pings), transition to `Disconnected` and notify user.

### 7.3 OscTransport

**Responsibility:** Low-level OSC send/receive. Wraps `node-osc`.

```typescript
class OscTransport {
  private client: osc.Client;   // sends to server
  private server: osc.Server;   // listens for responses

  send(address: string, ...args: OscArgument[]): void;
  onMessage(address: string, handler: OscHandler): Disposable;
  close(): void;
}
```

**Design decisions:**
- One `OscTransport` instance per connection.
- The `server` (listener) binds to the GUI port. If the port is in use (e.g., Sonic Pi GUI is open), report a clear error: "Port {N} is in use. Close the Sonic Pi application or change the port in settings."
- All OSC message handlers are registered via `onMessage` and return `Disposable` for clean teardown.

### 7.4 Heartbeat

**Responsibility:** Sends `/daemon/keep-alive` at a fixed interval to prevent the daemon's zombie kill switch from triggering.

| Config | Default | Description |
|--------|---------|-------------|
| `interval` | 30 000 ms | Time between keep-alive messages. |

Starts when state enters `Connected`. Stops when state leaves `Connected`.

### 7.5 CommandHandler

**Responsibility:** Maps VS Code commands to OSC messages.

| Command ID | OSC Message | Behavior |
|------------|-------------|----------|
| `sonicpi.run` | `/save-and-run-buffer` | Send active editor contents. Filename = file path or "untitled". Workspace = folder name or "default". |
| `sonicpi.runSelection` | `/run-code` | Send selected text only. Agent name = "vscode". |
| `sonicpi.stop` | `/stop-all-jobs` | Stop all running threads. |
| `sonicpi.connect` | (internal) | Trigger `ConnectionManager.connect()`. |
| `sonicpi.disconnect` | (internal) | Trigger `ConnectionManager.disconnect()`. |
| `sonicpi.startRecording` | `/start-recording` | Begin audio recording. |
| `sonicpi.stopRecording` | `/stop-recording` | End audio recording. |
| `sonicpi.saveRecording` | `/save-recording` | Save recording to user-chosen path. |
| `sonicpi.beautify` | `/beautify-buffer` | Send buffer for alignment; apply `/replace-buffer` response. |

Commands that require a connection check `ConnectionManager.getState()` and show an error if not connected.

### 7.6 LanguageProvider

#### 7.6.1 TextMate Grammar

Extends Ruby grammar with Sonic Pi-specific scopes:

| Scope | Tokens |
|-------|--------|
| `keyword.control.sonicpi` | `live_loop`, `in_thread`, `at`, `with_fx`, `with_synth` |
| `support.function.sonicpi` | `play`, `play_pattern`, `play_pattern_timed`, `play_chord`, `sample`, `sleep`, `use_synth`, `use_bpm`, `use_random_seed`, `cue`, `sync`, `stop`, `tick`, `look`, `tuplets` |
| `constant.language.note.sonicpi` | `:c`, `:d`, `:e`, `:f`, `:g`, `:a`, `:b` and variants (`:cs`, `:eb`, `:c4`, etc.) |
| `constant.language.synth.sonicpi` | `:sine`, `:saw`, `:pulse`, `:prophet`, `:tb303`, `:piano`, `:pluck`, `:supersaw`, etc. |
| `constant.language.sample.sonicpi` | `:bd_haus`, `:ambi_choir`, `:loop_amen`, etc. |
| `constant.language.fx.sonicpi` | `:reverb`, `:echo`, `:distortion`, `:lpf`, `:hpf`, `:flanger`, etc. |

#### 7.6.2 CompletionProvider

Triggers on `:` (symbol prefix) and after known function names.

**Data source:** Bundled `sonic-pi-data.json` containing:
- All synth names + their opts (with types and defaults).
- All sample names + categories.
- All FX names + their opts.
- All DSL function signatures.

**Completion item kinds:**
- Synths → `CompletionItemKind.Enum`
- Samples → `CompletionItemKind.Value`
- Functions → `CompletionItemKind.Function`
- Opts → `CompletionItemKind.Property`

#### 7.6.3 HoverProvider

On hover over a synth, sample, FX, or DSL function name, show:
- Short description.
- Parameter list with types and defaults.
- Link to full docs on sonic-pi.net.

#### 7.6.4 DiagnosticsProvider

Listens for `/error` messages from the server. Parses the error text to extract:
- File/workspace name.
- Line number.
- Error description.

Maps these to `vscode.Diagnostic` entries in the Problems panel and shows inline squiggles in the editor.

### 7.7 LogManager

**Responsibility:** Receives server log messages and renders them.

**Output channel:** `Sonic Pi Log` (created via `vscode.window.createOutputChannel`).

**Message type mapping** (from `/multi_message` type codes):

| Type Code | Label | Rendering |
|-----------|-------|-----------|
| 0 | Default | Plain text |
| 1 | User (`puts`) | Prefixed with `=>` |
| 2 | Warning | Prefixed with `[!]` |
| 3 | Serious warning | Prefixed with `[!!]` |
| 4 | Highlighted (pink) | Prefixed with `[*]` |
| 5 | Cue | Prefixed with `[cue]` |
| 6 | Sync | Prefixed with `[sync]` |

**Format:** `[HH:MM:SS] run:N thread:NAME  message`

### 7.8 StatusBarManager

A `vscode.StatusBarItem` on the left side of the status bar.

| State | Icon | Text | Tooltip | Click action |
|-------|------|------|---------|-------------|
| Disconnected | `$(circle-slash)` | Sonic Pi | "Click to connect" | `sonicpi.connect` |
| Connecting | `$(sync~spin)` | Sonic Pi | "Connecting..." | — |
| Connected | `$(check)` | Sonic Pi | "Connected on port {N}" | `sonicpi.disconnect` |

### 7.9 ConfigManager

Reads from VS Code settings (`vscode.workspace.getConfiguration('sonicpi')`).

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `sonicpi.osc.host` | string | `"127.0.0.1"` | OSC target host. |
| `sonicpi.osc.sendPort` | number | `4557` | Port to send commands to. |
| `sonicpi.osc.listenPort` | number | `4558` | Port to listen for responses. |
| `sonicpi.osc.daemonPort` | number | `0` | Daemon keep-alive port (0 = auto-discover). |
| `sonicpi.autoConnect` | boolean | `true` | Connect automatically when a `.spi` file is opened. |
| `sonicpi.heartbeatInterval` | number | `30000` | Keep-alive interval in ms. |
| `sonicpi.sonicPiPath` | string | `""` | Path to Sonic Pi installation (for daemon auto-start). |
| `sonicpi.logLevel` | enum | `"info"` | Minimum log level to display: `debug`, `info`, `warning`, `error`. |

---

## 8. Data Models & Schemas

### 8.1 Sonic Pi Data File (`sonic-pi-data.json`)

Bundled with the extension. Generated/maintained from Sonic Pi source.

```jsonc
{
  "version": "4.6.0",
  "synths": [
    {
      "name": "sine",
      "doc": "A simple sine wave synth.",
      "opts": [
        { "name": "note", "type": "number", "default": 52, "doc": "MIDI note number." },
        { "name": "amp", "type": "number", "default": 1, "doc": "Amplitude (0-1)." },
        { "name": "pan", "type": "number", "default": 0, "doc": "Stereo pan (-1 to 1)." },
        { "name": "attack", "type": "number", "default": 0, "doc": "Attack time in beats." },
        { "name": "release", "type": "number", "default": 1, "doc": "Release time in beats." }
        // ...
      ]
    }
    // ... all synths
  ],
  "samples": [
    {
      "name": "bd_haus",
      "category": "bass_drums",
      "doc": "A bass drum sample."
    }
    // ... all samples
  ],
  "fx": [
    {
      "name": "reverb",
      "doc": "A reverb effect.",
      "opts": [
        { "name": "mix", "type": "number", "default": 0.4, "doc": "Dry/wet mix." },
        { "name": "room", "type": "number", "default": 0.6, "doc": "Room size." }
        // ...
      ]
    }
    // ... all FX
  ],
  "lang": [
    {
      "name": "play",
      "signature": "play(note, opts?)",
      "doc": "Play a note with the current synth.",
      "args": [
        { "name": "note", "type": "number|symbol", "doc": "MIDI note or note name." }
      ]
    },
    {
      "name": "live_loop",
      "signature": "live_loop(name, &block)",
      "doc": "Create a named loop that runs in its own thread.",
      "args": [
        { "name": "name", "type": "symbol", "doc": "Unique loop name." }
      ]
    }
    // ... all DSL functions
  ]
}
```

### 8.2 OSC Message Types (TypeScript)

```typescript
type OscArgument = string | number | Buffer;

interface OscMessage {
  address: string;
  args: OscArgument[];
}

interface MultiMessage {
  runId: number;
  threadName: string;
  timestamp: string;
  entries: Array<{
    type: number;   // 0-6
    text: string;
  }>;
}

interface ServerError {
  message: string;
  line?: number;
  file?: string;
}
```

### 8.3 Connection State (TypeScript)

```typescript
enum ConnectionState {
  Disconnected = 'disconnected',
  Connecting   = 'connecting',
  Connected    = 'connected',
  Disconnecting = 'disconnecting',
}

interface ConnectionInfo {
  state: ConnectionState;
  ports: PortMap | null;
  lastAck: Date | null;
  error: string | null;
}
```

---

## 9. Extension File & Directory Layout

```
vs-sonic-pi/
├── .vscode/
│   ├── launch.json              # Debug configurations for extension dev
│   └── tasks.json               # Build tasks
├── src/
│   ├── extension.ts             # Entry point (activate / deactivate)
│   ├── commands/
│   │   ├── index.ts             # Register all commands
│   │   ├── run.ts               # Run code command
│   │   ├── stop.ts              # Stop all command
│   │   ├── record.ts            # Recording commands
│   │   └── beautify.ts          # Beautify buffer command
│   ├── connection/
│   │   ├── ConnectionManager.ts # State machine, orchestrates connect/disconnect
│   │   ├── OscTransport.ts      # Low-level OSC send/receive wrapper
│   │   ├── Heartbeat.ts         # Keep-alive timer
│   │   ├── DaemonSpawner.ts     # Optional: spawn daemon.rb
│   │   └── PortDiscovery.ts     # Read port map from file / config / daemon
│   ├── language/
│   │   ├── CompletionProvider.ts
│   │   ├── HoverProvider.ts
│   │   ├── DiagnosticsProvider.ts
│   │   └── snippets.json        # VS Code snippet definitions
│   ├── log/
│   │   ├── LogManager.ts        # Owns Output channel, formats messages
│   │   └── LogFormatter.ts      # Parses /multi_message into display strings
│   ├── ui/
│   │   ├── StatusBarManager.ts  # Status bar item
│   │   └── CueLogView.ts       # (Phase 3) Webview for cue log
│   ├── config/
│   │   └── ConfigManager.ts     # Reads VS Code settings
│   ├── data/
│   │   └── sonic-pi-data.json   # Bundled synth/sample/FX/lang data
│   └── types/
│       ├── osc.ts               # OSC-related type definitions
│       └── sonicpi.ts           # Sonic Pi domain types
├── syntaxes/
│   └── sonicpi.tmLanguage.json  # TextMate grammar
├── examples/
│   ├── 01-getting-started.spi
│   ├── 02-live-loop.spi
│   ├── 03-samples.spi
│   ├── 04-synths.spi
│   └── 05-fx.spi
├── test/
│   ├── unit/
│   │   ├── OscTransport.test.ts
│   │   ├── ConnectionManager.test.ts
│   │   ├── LogFormatter.test.ts
│   │   └── CompletionProvider.test.ts
│   └── integration/
│       └── extension.test.ts    # Full extension activation test
├── package.json                 # Extension manifest
├── tsconfig.json
├── esbuild.config.mjs           # Build config
├── .eslintrc.json
├── .prettierrc
├── PRD.md                       # This document
└── LICENSE
```

### 9.1 `package.json` Key Sections

```jsonc
{
  "name": "vs-sonic-pi",
  "displayName": "Sonic Pi for VS Code",
  "description": "Code. Music. Live. — Write and perform Sonic Pi music from VS Code.",
  "version": "0.1.0",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Programming Languages", "Other"],
  "activationEvents": [
    "onLanguage:sonicpi"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "languages": [{
      "id": "sonicpi",
      "aliases": ["Sonic Pi", "sonicpi"],
      "extensions": [".spi", ".sonicpi"],
      "configuration": "./language-configuration.json"
    }],
    "grammars": [{
      "language": "sonicpi",
      "scopeName": "source.sonicpi",
      "path": "./syntaxes/sonicpi.tmLanguage.json"
    }],
    "commands": [
      { "command": "sonicpi.run",            "title": "Sonic Pi: Run" },
      { "command": "sonicpi.runSelection",   "title": "Sonic Pi: Run Selection" },
      { "command": "sonicpi.stop",           "title": "Sonic Pi: Stop" },
      { "command": "sonicpi.connect",        "title": "Sonic Pi: Connect" },
      { "command": "sonicpi.disconnect",     "title": "Sonic Pi: Disconnect" },
      { "command": "sonicpi.openExamples",   "title": "Sonic Pi: Open Examples" },
      { "command": "sonicpi.startRecording", "title": "Sonic Pi: Start Recording" },
      { "command": "sonicpi.stopRecording",  "title": "Sonic Pi: Stop Recording" },
      { "command": "sonicpi.saveRecording",  "title": "Sonic Pi: Save Recording" },
      { "command": "sonicpi.beautify",       "title": "Sonic Pi: Beautify Buffer" }
    ],
    "keybindings": [
      { "command": "sonicpi.run",          "key": "f5",       "when": "editorLangId == sonicpi" },
      { "command": "sonicpi.stop",         "key": "shift+f5", "when": "editorLangId == sonicpi" },
      { "command": "sonicpi.runSelection", "key": "ctrl+f5",  "mac": "cmd+f5", "when": "editorLangId == sonicpi" }
    ],
    "configuration": {
      "title": "Sonic Pi",
      "properties": {
        "sonicpi.osc.host":            { "type": "string",  "default": "127.0.0.1" },
        "sonicpi.osc.sendPort":        { "type": "number",  "default": 4557 },
        "sonicpi.osc.listenPort":      { "type": "number",  "default": 4558 },
        "sonicpi.osc.daemonPort":      { "type": "number",  "default": 0 },
        "sonicpi.autoConnect":         { "type": "boolean", "default": true },
        "sonicpi.heartbeatInterval":   { "type": "number",  "default": 30000 },
        "sonicpi.sonicPiPath":         { "type": "string",  "default": "" },
        "sonicpi.logLevel":            { "type": "string",  "default": "info", "enum": ["debug","info","warning","error"] }
      }
    },
    "snippets": [{
      "language": "sonicpi",
      "path": "./src/language/snippets.json"
    }]
  }
}
```

---

## 10. User Experience

### 10.1 First Run

1. User installs the extension from the VS Code Marketplace.
2. User opens or creates a `.spi` file. Syntax highlighting activates immediately.
3. Status bar shows `$(circle-slash) Sonic Pi` (disconnected).
4. User presses **F5** (or runs "Sonic Pi: Run").
   - If Sonic Pi is running: extension connects, sends code, log panel opens with output.
   - If Sonic Pi is not running: notification — *"Sonic Pi server not detected. Please start the Sonic Pi application and try again."* with buttons: **[Download Sonic Pi]** | **[Retry]**.
5. Once connected, status bar shows `$(check) Sonic Pi`.

### 10.2 Daily Workflow

```
Open .spi file  →  F5 (Run)  →  hear music  →  edit live_loop  →  F5 again
                                                                    ↓
                                                              loop updates live
                                                                    ↓
                                                              Shift+F5 (Stop)
```

### 10.3 Keyboard Shortcuts

| Action | Shortcut | Context |
|--------|----------|---------|
| Run buffer | `F5` | `editorLangId == sonicpi` |
| Stop all | `Shift+F5` | `editorLangId == sonicpi` |
| Run selection | `Ctrl+F5` / `Cmd+F5` | `editorLangId == sonicpi` |

### 10.4 Log Panel

```
[14:32:01] run:1  thread:live_loop_beat
 => Playing :bd_haus
[14:32:01] run:1  thread:live_loop_beat
 => Sleeping for 0.5 beats
[14:32:02] run:1  thread:live_loop_melody
 => Playing note 72 with :prophet
[14:32:05] [!] Warning: sample :foo not found
[14:32:10] [ERROR] Runtime Error in buffer workspace_0, line 5:
           undefined method 'plya' - did you mean 'play'?
```

---

## 11. Phased Delivery Plan

### Phase 1 — MVP (Weeks 1–4)

| Week | Deliverable |
|------|-------------|
| 1 | Project scaffold (`package.json`, TypeScript config, build pipeline). TextMate grammar. Basic `extension.ts` with activate/deactivate. |
| 2 | `OscTransport`, `ConnectionManager` (state machine, `/ping`→`/ack`), `Heartbeat`. Manual connect/disconnect commands. |
| 3 | `CommandHandler` (Run, Stop). `LogManager` (Output channel, `/multi_message` parsing). |
| 4 | `ConfigManager`. Status bar. End-to-end testing with live Sonic Pi. Bug fixes. |

**Exit criteria:** User can open a `.spi` file, press F5, hear music, see logs, press Shift+F5 to stop.

### Phase 2 — V1 (Weeks 5–8)

| Week | Deliverable |
|------|-------------|
| 5 | `CompletionProvider` + `sonic-pi-data.json` (synths, samples, FX). |
| 6 | `HoverProvider`. `DiagnosticsProvider` (error → Problems panel). |
| 7 | Run selection. Bundled examples. `DaemonSpawner` (optional auto-start). |
| 8 | Polish, docs, marketplace listing, publish v0.1.0. |

**Exit criteria:** Full language support (completion, hover, diagnostics). Published on VS Code Marketplace.

### Phase 3 — Enhancements (Ongoing)

- Recording commands.
- Beautify buffer.
- Tutorial webview.
- Cue log panel.
- MIDI monitor.
- Audio scope visualizer (stretch).

---

## 12. Testing Strategy

### 12.1 Unit Tests

| Module | What to test |
|--------|-------------|
| `OscTransport` | Send/receive with mock UDP socket. Message serialization. |
| `ConnectionManager` | State transitions. Retry logic. Timeout handling. |
| `LogFormatter` | Parsing `/multi_message` args into formatted strings. All type codes. |
| `CompletionProvider` | Correct items for synth/sample/FX contexts. Trigger characters. |
| `HoverProvider` | Correct docs for known symbols. Graceful fallback for unknown. |
| `DiagnosticsProvider` | Error message parsing. Line number extraction. |
| `ConfigManager` | Default values. Override handling. |

### 12.2 Integration Tests

| Test | Description |
|------|-------------|
| Activation | Extension activates on `.spi` file open. |
| Connect/Disconnect | Full handshake with a mock OSC server. |
| Run + Log | Send code, receive `/multi_message`, verify Output channel content. |
| Error flow | Send bad code, receive `/error`, verify Problems panel entry. |

### 12.3 Manual / E2E Tests

| Test | Description |
|------|-------------|
| Live Sonic Pi | Run extension against a real Sonic Pi instance. Verify audio output. |
| Port conflict | Start Sonic Pi GUI, then try extension. Verify clear error message. |
| Cross-platform | Test on macOS, Windows, Linux. |

---

## 13. Success Metrics

| Metric | Target |
|--------|--------|
| **Run latency** | Time from F5 to first log line < 2 s. |
| **Reliability** | Run and Stop work consistently (>99% success rate when server is running). |
| **Clarity** | Users without Sonic Pi get a clear, actionable message within 1 s of attempting Run. |
| **Adoption** | 500+ installs within 3 months of Marketplace publish. |
| **Satisfaction** | 4+ star average rating on Marketplace. |

---

## 14. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Port conflict** — Sonic Pi GUI and extension both need port 4558. | High | High | Document "close GUI when using VS Code." Investigate upstream support for multi-client log port. Allow configurable listen port. |
| **Zombie kill switch** — Daemon kills server if keep-alive not sent. | High | Medium | Implement heartbeat from day 1 (FR-6). Test thoroughly. |
| **OSC API changes** — Future Sonic Pi versions change message format. | Medium | Low | Pin to documented API. Add version detection. Follow Sonic Pi changelog. |
| **No headless mode** — Users must start the full Sonic Pi app. | Medium | High | Phase 2: `DaemonSpawner` to start `daemon.rb` directly. Document workaround for Phase 1. |
| **`node-osc` limitations** — Library bugs or missing features. | Low | Low | `node-osc` is mature. Fallback: raw `dgram` UDP if needed. |
| **Cross-platform port behavior** — Windows firewall blocks UDP. | Medium | Medium | Document firewall requirements. Test on all platforms. |

---

## 15. References & Prior Art

| Resource | URL |
|----------|-----|
| Sonic Pi source | https://github.com/sonic-pi-net/sonic-pi |
| Sonic Pi tutorial | https://sonic-pi.net/tutorial.html |
| Sonic Pi OSC API (Wiki) | https://github.com/sonic-pi-net/sonic-pi/wiki/Sonic-Pi-Internals----GUI-Ruby-API |
| Sonic Pi internals | https://github.com/sonic-pi-net/sonic-pi/wiki/Sonic-Pi-Internals |
| Existing VS Code extension (s00500) | https://marketplace.visualstudio.com/items?itemName=s00500.sonic-pi-extension |
| sonic-pi-cli | https://github.com/Widdershin/sonic-pi-cli |
| sonic-pi-js-api | https://github.com/SunderB/sonic-pi-js-api |
| Sonic Pi headless issue | https://github.com/sonic-pi-net/sonic-pi/issues/3407 |
| VS Code Extension API | https://code.visualstudio.com/api |
| node-osc (npm) | https://www.npmjs.com/package/node-osc |

---

## 16. Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | March 2025 | Initial PRD based on Sonic Pi repo and OSC API. |
| 2.0 | March 2025 | Expanded with full architectural design: module specs, state machine, sequence diagrams, data models, directory layout, phased delivery plan, and testing strategy. |
