# Configuration Manager

**Module:** `src/config/ConfigManager.ts`  
**Phase:** 1 (MVP)  
**Dependencies:** VS Code `workspace.getConfiguration` API

---

## Purpose

The Configuration Manager provides a single, typed interface for reading extension settings. All other modules read their configuration through this module rather than calling `vscode.workspace.getConfiguration` directly. This centralizes default values, validation, and change detection.

---

## Responsibilities

1. **Read** settings from the `sonicpi.*` namespace in VS Code's configuration system.
2. **Provide typed accessors** for each setting, with validated defaults.
3. **Emit change events** when the user modifies settings (so modules like ConnectionManager can react without a restart).
4. **Validate** values at read time (e.g., port numbers must be 1–65535).

---

## Public Interface

```typescript
import { Disposable, Event } from 'vscode';

interface SonicPiConfig {
  osc: {
    host: string;
    sendPort: number;
    listenPort: number;
    daemonPort: number;
  };
  autoConnect: boolean;
  heartbeatInterval: number;
  sonicPiPath: string;
  logLevel: LogLevel;
}

type LogLevel = 'debug' | 'info' | 'warning' | 'error';

class ConfigManager implements Disposable {

  /** Event fired when any sonicpi.* setting changes. */
  readonly onDidChangeConfig: Event<SonicPiConfig>;

  /** Read the current configuration snapshot. */
  getConfig(): SonicPiConfig;

  /** Clean up the configuration change listener. */
  dispose(): void;
}
```

---

## Settings Reference

All settings live under the `sonicpi` namespace in VS Code's `settings.json`.

| Key | Type | Default | Validation | Description |
|-----|------|---------|------------|-------------|
| `sonicpi.osc.host` | `string` | `"127.0.0.1"` | Non-empty string | IP address or hostname of the Sonic Pi server. Almost always localhost. |
| `sonicpi.osc.sendPort` | `number` | `4557` | 1–65535 | UDP port the extension sends commands to (Sonic Pi server's listen port). |
| `sonicpi.osc.listenPort` | `number` | `4558` | 1–65535 | UDP port the extension binds to for receiving server responses. |
| `sonicpi.osc.daemonPort` | `number` | `0` | 0–65535 | Port for `/daemon/keep-alive` messages. `0` means auto-discover from port file or use `sendPort`. |
| `sonicpi.autoConnect` | `boolean` | `true` | — | Whether to automatically connect when a `.spi` file is opened. |
| `sonicpi.heartbeatInterval` | `number` | `30000` | 5000–120000 | Milliseconds between `/daemon/keep-alive` messages. |
| `sonicpi.sonicPiPath` | `string` | `""` | Valid path or empty | Path to the Sonic Pi installation directory. Used by DaemonSpawner to locate `daemon.rb`. Empty means auto-detect. |
| `sonicpi.logLevel` | `string` | `"info"` | One of: `debug`, `info`, `warning`, `error` | Minimum log level to display in the Output channel. |

### package.json Declaration

```jsonc
"configuration": {
  "title": "Sonic Pi",
  "properties": {
    "sonicpi.osc.host": {
      "type": "string",
      "default": "127.0.0.1",
      "description": "IP address of the Sonic Pi server."
    },
    "sonicpi.osc.sendPort": {
      "type": "number",
      "default": 4557,
      "minimum": 1,
      "maximum": 65535,
      "description": "UDP port to send OSC commands to."
    },
    "sonicpi.osc.listenPort": {
      "type": "number",
      "default": 4558,
      "minimum": 1,
      "maximum": 65535,
      "description": "UDP port to listen for server responses."
    },
    "sonicpi.osc.daemonPort": {
      "type": "number",
      "default": 0,
      "minimum": 0,
      "maximum": 65535,
      "description": "Port for keep-alive messages (0 = auto-discover)."
    },
    "sonicpi.autoConnect": {
      "type": "boolean",
      "default": true,
      "description": "Automatically connect to Sonic Pi when a .spi file is opened."
    },
    "sonicpi.heartbeatInterval": {
      "type": "number",
      "default": 30000,
      "minimum": 5000,
      "maximum": 120000,
      "description": "Milliseconds between keep-alive heartbeats."
    },
    "sonicpi.sonicPiPath": {
      "type": "string",
      "default": "",
      "description": "Path to Sonic Pi installation (empty = auto-detect)."
    },
    "sonicpi.logLevel": {
      "type": "string",
      "default": "info",
      "enum": ["debug", "info", "warning", "error"],
      "enumDescriptions": [
        "Show all messages including internal debug output.",
        "Show user output, cues, syncs, and errors (default).",
        "Show warnings and errors only.",
        "Show errors only."
      ],
      "description": "Minimum log level to display in the Sonic Pi Log."
    }
  }
}
```

---

## Implementation Detail

### Reading Configuration

```typescript
class ConfigManager implements Disposable {
  private disposables: Disposable[] = [];
  private emitter = new vscode.EventEmitter<SonicPiConfig>();
  readonly onDidChangeConfig = this.emitter.event;

  constructor() {
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('sonicpi')) {
          this.emitter.fire(this.getConfig());
        }
      }),
    );
  }

  getConfig(): SonicPiConfig {
    const cfg = vscode.workspace.getConfiguration('sonicpi');
    return {
      osc: {
        host: cfg.get<string>('osc.host', '127.0.0.1'),
        sendPort: this.clampPort(cfg.get<number>('osc.sendPort', 4557)),
        listenPort: this.clampPort(cfg.get<number>('osc.listenPort', 4558)),
        daemonPort: this.clampPort(cfg.get<number>('osc.daemonPort', 0), true),
      },
      autoConnect: cfg.get<boolean>('autoConnect', true),
      heartbeatInterval: this.clamp(cfg.get<number>('heartbeatInterval', 30000), 5000, 120000),
      sonicPiPath: cfg.get<string>('sonicPiPath', ''),
      logLevel: this.validateLogLevel(cfg.get<string>('logLevel', 'info')),
    };
  }

  private clampPort(value: number, allowZero = false): number {
    const min = allowZero ? 0 : 1;
    return Math.max(min, Math.min(65535, Math.round(value)));
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private validateLogLevel(value: string): LogLevel {
    const valid: LogLevel[] = ['debug', 'info', 'warning', 'error'];
    return valid.includes(value as LogLevel) ? (value as LogLevel) : 'info';
  }

  dispose(): void {
    this.emitter.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}
```

### Change Detection

When the user changes a setting in VS Code's Settings UI or `settings.json`, the `onDidChangeConfiguration` event fires. The ConfigManager checks if the change affects the `sonicpi` namespace and, if so, emits a new `SonicPiConfig` snapshot.

Consumers react to changes:

| Consumer | Reaction to config change |
|----------|---------------------------|
| `ConnectionManager` | If port settings changed while connected, show notification: "Port settings changed. Reconnect to apply." |
| `LogManager` | If `logLevel` changed, apply new filter immediately (no reconnect needed). |
| `Heartbeat` | If `heartbeatInterval` changed, restart the timer with the new interval. |

---

## Testing

### Unit Tests (`test/unit/ConfigManager.test.ts`)

| Test | Description |
|------|-------------|
| `returns defaults when no config set` | Verify all fields match documented defaults. |
| `reads overridden values` | Mock VS Code config with custom values. Verify `getConfig()` returns them. |
| `clamps invalid port to range` | Set `sendPort` to 99999. Verify clamped to 65535. |
| `clamps negative port` | Set `sendPort` to -1. Verify clamped to 1. |
| `validates logLevel` | Set `logLevel` to "invalid". Verify falls back to "info". |
| `clamps heartbeat interval` | Set to 1000 (below minimum). Verify clamped to 5000. |
| `emits change event` | Simulate config change. Verify `onDidChangeConfig` fires with new snapshot. |
| `change event only fires for sonicpi namespace` | Simulate change to unrelated setting. Verify event does not fire. |
