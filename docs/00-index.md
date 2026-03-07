# Sonic Pi VS Code Extension — Functional Component Documentation

This directory contains the detailed design documentation for each functional component of the **vs-sonic-pi** extension. Each document is self-contained: it describes a module's purpose, public interface, internal design, configuration, data flow, error handling, and testing strategy.

For the high-level product requirements and architectural overview, see [PRD.md](../PRD.md).

---

## Component Map

```
extension.ts (entry point)
    │
    ├── ConnectionManager ·········· 02-connection-manager.md
    │       ├── OscTransport ······· 01-osc-transport.md
    │       ├── Heartbeat ·········· 02-connection-manager.md (§ Health Monitoring)
    │       ├── PortDiscovery ······ 08-daemon-spawner.md (Part 1)
    │       └── DaemonSpawner ······ 08-daemon-spawner.md (Part 2)
    │
    ├── CommandHandler ············· 03-command-handler.md
    │       ├── Run (buffer)
    │       ├── Run (selection)
    │       ├── Stop
    │       ├── Record
    │       └── Beautify
    │
    ├── LanguageProvider ··········· 04-language-provider.md
    │       ├── TextMate Grammar
    │       ├── Snippets
    │       ├── CompletionProvider
    │       ├── HoverProvider
    │       └── DiagnosticsProvider
    │
    ├── LogManager ················· 05-log-manager.md
    │       └── LogFormatter
    │
    ├── StatusBarManager ··········· 06-status-bar.md
    │
    └── ConfigManager ·············· 07-config-manager.md
```

---

## Documents

| # | Document | Component | Phase | Summary |
|---|----------|-----------|-------|---------|
| 01 | [OSC Transport](./01-osc-transport.md) | `OscTransport` | 1 (MVP) | Low-level UDP send/receive over OSC. Wraps `node-osc`. All network I/O flows through this layer. |
| 02 | [Connection Manager](./02-connection-manager.md) | `ConnectionManager` | 1 (MVP) | State machine governing the connection lifecycle (Disconnected → Connecting → Connected → Disconnecting). Orchestrates port discovery, handshake, heartbeat, and health monitoring. |
| 03 | [Command Handler](./03-command-handler.md) | `CommandHandler` | 1–3 | Maps VS Code commands (Run, Stop, Record, Beautify, etc.) to OSC messages. Reads editor state, guards against disconnected state, and handles responses. |
| 04 | [Language Provider](./04-language-provider.md) | `LanguageProvider` | 1–2 | Syntax highlighting (TextMate grammar), code snippets, IntelliSense completions, hover documentation, and inline error diagnostics. |
| 05 | [Log Manager](./05-log-manager.md) | `LogManager` | 1 (MVP) | Receives `/multi_message`, `/info`, and `/error` from the server. Formats and renders log output in a VS Code Output channel with timestamps, type prefixes, and log-level filtering. |
| 06 | [Status Bar](./06-status-bar.md) | `StatusBarManager` | 1 (MVP) | Persistent status bar indicator showing connection state (icon + text). Click to connect or disconnect. |
| 07 | [Configuration](./07-config-manager.md) | `ConfigManager` | 1 (MVP) | Typed, validated access to all `sonicpi.*` settings. Emits change events so modules can react without restart. |
| 08 | [Daemon Spawner & Port Discovery](./08-daemon-spawner.md) | `PortDiscovery`, `DaemonSpawner` | 1–2 | Discovers which ports the Sonic Pi server is using (port file, config, defaults). Optionally spawns `daemon.rb` to start the server without the Qt GUI. |
| 09 | [Sonic Pi Codebase Analysis](./09-sonic-pi-codebase-analysis.md) | *(reference)* | — | Deep analysis of the forked Sonic Pi repo. Catalogs every library, data file, and protocol detail that can be utilized or integrated into the extension. |

---

## Reading Order

For someone new to the codebase, the recommended reading order is:

1. **[PRD.md](../PRD.md)** — Start here for the big picture: vision, architecture diagrams, requirements, and phased delivery plan.
2. **[01 — OSC Transport](./01-osc-transport.md)** — Understand the networking foundation.
3. **[02 — Connection Manager](./02-connection-manager.md)** — Understand the state machine that everything else depends on.
4. **[07 — Configuration](./07-config-manager.md)** — Understand how settings flow into all modules.
5. **[03 — Command Handler](./03-command-handler.md)** — Understand how user actions become OSC messages.
6. **[05 — Log Manager](./05-log-manager.md)** — Understand how server output reaches the user.
7. **[04 — Language Provider](./04-language-provider.md)** — Understand the editor experience (syntax, completion, hover, diagnostics).
8. **[06 — Status Bar](./06-status-bar.md)** — Small but important UI piece.
9. **[08 — Daemon Spawner](./08-daemon-spawner.md)** — Advanced: auto-starting the server.

---

## Cross-Cutting Concerns

### Disposable Pattern

Every module implements `vscode.Disposable`. All disposables are pushed to `context.subscriptions` in `activate()` so VS Code cleans them up automatically on deactivation. Modules that create sub-disposables (e.g., event listeners, timers) track them internally and dispose them in their own `dispose()` method.

### Error Reporting

Errors are surfaced to the user through three channels:

| Channel | Used for | Example |
|---------|----------|---------|
| `vscode.window.showErrorMessage` | Connection failures, missing server | "Cannot reach Sonic Pi server." |
| Output channel (`Sonic Pi Log`) | Server-reported errors, warnings | Runtime error with line number |
| Problems panel (Diagnostics) | Parsed errors with file/line info | Inline squiggle on the error line |

### Event Flow

```
User presses F5
    │
    ▼
CommandHandler.runBuffer()
    │
    ├── checks ConnectionManager.getState() → Connected?
    │       └── No → show error, offer to connect
    │
    ├── reads editor text
    │
    └── OscTransport.send('/save-and-run-buffer', ...)
            │
            ▼
        Sonic Pi Server evaluates code
            │
            ├── /multi_message → OscTransport → LogManager → Output channel
            ├── /error         → OscTransport → LogManager + DiagnosticsProvider
            └── (audio output via scsynth)
```

### Phased Implementation

| Phase | Components | Exit Criteria |
|-------|------------|---------------|
| **1 (MVP)** | OscTransport, ConnectionManager, Heartbeat, PortDiscovery (file + defaults), CommandHandler (Run, Stop), LogManager, StatusBar, ConfigManager, TextMate grammar, Snippets | User can run code, hear music, see logs, stop. |
| **2 (V1)** | CompletionProvider, HoverProvider, DiagnosticsProvider, Run Selection, Examples, DaemonSpawner | Full language support. Published on Marketplace. |
| **3 (Enhancements)** | Recording, Beautify, Tutorial webview, Cue log, MIDI monitor | Feature parity with native app. |
