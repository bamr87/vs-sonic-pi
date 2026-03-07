# Log Manager

**Modules:** `src/log/LogManager.ts`, `src/log/LogFormatter.ts`  
**Phase:** 1 (MVP)  
**Dependencies:** `ConnectionManager`, `OscTransport`, `ConfigManager`

---

## Purpose

The Log Manager receives real-time output from the Sonic Pi server — log messages, user `puts` output, warnings, cue events — and renders them in a VS Code Output channel. It is the primary feedback mechanism that tells the user what Sonic Pi is doing. In the native Sonic Pi app, this is the log pane on the right side of the window. In the extension, it is the "Sonic Pi Log" Output channel.

---

## Responsibilities

1. **Subscribe** to incoming OSC messages (`/multi_message`, `/info`, `/error`) via the transport.
2. **Parse** the raw OSC arguments into structured log entries.
3. **Format** entries into human-readable lines with timestamps, run IDs, thread names, and type prefixes.
4. **Filter** entries based on the configured log level.
5. **Render** formatted lines to the VS Code Output channel.
6. **Auto-show** the Output channel when new log output arrives (configurable).

---

## Public Interface

```typescript
import { Disposable } from 'vscode';

class LogManager implements Disposable {

  constructor(connectionManager: ConnectionManager);

  /** Clear all log output. */
  clear(): void;

  /** Show the Output channel in the panel. */
  show(): void;

  /** Clean up the Output channel and unsubscribe from transport. */
  dispose(): void;
}
```

The LogManager is mostly passive — it subscribes to the transport and writes to the Output channel. The only active methods are `clear()` (bound to a future "Sonic Pi: Clear Log" command) and `show()` (called by the Run command to ensure the log is visible).

---

## OSC Message Handling

### /multi_message

This is the primary log message from the Sonic Pi server. It carries one or more log entries from a single evaluation step.

**OSC arguments (positional):**

| Index | Type | Description |
|-------|------|-------------|
| 0 | number | Run ID (which run produced this message) |
| 1 | string | Thread name (e.g., `"live_loop_beat"`) |
| 2 | string | Timestamp (server-side, e.g., `"0.0"`) |
| 3 | number | N — number of entries that follow |
| 4 | number | Entry 1 type code |
| 5 | string | Entry 1 text |
| 6 | number | Entry 2 type code (if N > 1) |
| 7 | string | Entry 2 text (if N > 1) |
| ... | ... | ... |

**Type codes:**

| Code | Meaning | Display prefix | Log level |
|------|---------|----------------|-----------|
| 0 | Default | (none) | `debug` |
| 1 | User message (`puts`, `print`) | `=>` | `info` |
| 2 | Warning | `[!]` | `warning` |
| 3 | Serious warning | `[!!]` | `warning` |
| 4 | Highlighted (pink in native app) | `[*]` | `info` |
| 5 | Cue | `[cue]` | `info` |
| 6 | Sync | `[sync]` | `info` |

### /info

A simple informational message from the server.

| Index | Type | Description |
|-------|------|-------------|
| 0 | string | Message text |

Rendered as: `[HH:MM:SS] [info] {message}`

### /error

An error message from the server (syntax or runtime error).

| Index | Type | Description |
|-------|------|-------------|
| 0 | string | Error text (may be multi-line) |

Rendered as: `[HH:MM:SS] [ERROR] {message}`

The error is also forwarded to the DiagnosticsProvider (see [04-language-provider.md](./04-language-provider.md)).

---

## LogFormatter

**File:** `src/log/LogFormatter.ts`

A pure function module (no state, no side effects) that converts raw OSC arguments into formatted strings.

### formatMultiMessage

```typescript
interface LogEntry {
  type: number;
  text: string;
}

interface FormattedLog {
  timestamp: string;   // "[HH:MM:SS]"
  runId: number;
  threadName: string;
  entries: Array<{
    prefix: string;    // e.g. "=>" or "[!]"
    text: string;
    level: LogLevel;
  }>;
}

function formatMultiMessage(args: OscArgument[]): FormattedLog;
```

### Format Rules

1. **Timestamp** — Use the local wall-clock time when the message is received (not the server timestamp, which is a relative beat count). Format: `[HH:MM:SS]`.

2. **Header line** — `[HH:MM:SS] run:{runId}  thread:{threadName}`

3. **Entry lines** — Each entry on its own line, indented, with the type prefix:
   ```
   [14:32:01] run:1  thread:live_loop_beat
    => Playing :bd_haus
    => Sleeping for 0.5 beats
   ```

4. **Multi-line entries** — If an entry's text contains newlines, each line is indented to align:
   ```
   [14:32:10] run:1  thread:main
    [ERROR] Runtime Error in buffer workspace_0, line 5:
            undefined method 'plya'
            Did you mean? play
   ```

---

## Log Level Filtering

The `sonicpi.logLevel` setting controls which messages are displayed:

| Setting | Shows |
|---------|-------|
| `debug` | Everything (type codes 0–6) |
| `info` | Types 1, 4, 5, 6 + `/info` + `/error` |
| `warning` | Types 2, 3 + `/error` |
| `error` | `/error` only |

Default is `info`, which matches the native Sonic Pi app's default behavior (shows user output, cues, syncs, and errors, but not internal debug messages).

---

## Output Channel

The LogManager creates a single `OutputChannel` named `"Sonic Pi Log"`:

```typescript
const channel = vscode.window.createOutputChannel('Sonic Pi Log');
```

### Behavior

| Event | Action |
|-------|--------|
| Log message received | Append formatted text to channel. |
| `sonicpi.run` invoked | Call `channel.show(true)` to reveal the panel (preserving focus on the editor). |
| `sonicpi.stop` invoked | No action on the log (stop doesn't clear). |
| "Sonic Pi: Clear Log" command | Call `channel.clear()`. |
| Extension deactivated | Call `channel.dispose()`. |

### Performance

The Output channel API (`appendLine`) is efficient for streaming text. For high-throughput scenarios (fast `live_loop` with many `puts` calls), the formatter batches entries from a single `/multi_message` into one `appendLine` call to minimize API overhead.

---

## Example Output

```
[14:32:00] ─── Sonic Pi Connected ───
[14:32:01] run:1  thread:live_loop_beat
 => Playing :bd_haus
 => Sleeping for 0.5 beats
[14:32:01] run:1  thread:live_loop_melody
 => Playing note 72 with :prophet
 => Sleeping for 0.25 beats
[14:32:02] run:1  thread:live_loop_beat
 => Playing :bd_haus
 => Sleeping for 0.5 beats
[14:32:05] run:1  thread:main
 [!] Warning: sample :foo not found
[14:32:10] run:1  thread:main
 [ERROR] Runtime Error in buffer workspace_0, line 5:
         undefined method 'plya' for #<SonicPi::...>
         Did you mean? play
[14:32:15] [info] All jobs stopped.
```

---

## Testing

### Unit Tests (`test/unit/LogFormatter.test.ts`)

| Test | Description |
|------|-------------|
| `formats basic multi_message` | Input: run=1, thread="main", type=1, text="Playing :bd_haus". Verify output matches expected format. |
| `formats multiple entries` | Input: two entries in one multi_message. Verify both appear under the same header. |
| `formats error prefix` | Input: `/error` message. Verify `[ERROR]` prefix. |
| `formats warning prefix` | Input: type=2 entry. Verify `[!]` prefix. |
| `formats cue prefix` | Input: type=5 entry. Verify `[cue]` prefix. |
| `handles multi-line error text` | Input: error with newlines. Verify continuation lines are indented. |
| `filters by log level` | Set level to `warning`. Input type=1 (user message). Verify it is filtered out. |
| `filters by log level (pass)` | Set level to `warning`. Input type=2 (warning). Verify it passes through. |
| `timestamp uses local time` | Verify timestamp format is `[HH:MM:SS]` and reflects the current clock. |

### Integration Tests

| Test | Description |
|------|-------------|
| `log appears in Output channel` | Connect to mock server, send code, simulate `/multi_message`. Verify Output channel contains expected text. |
| `log auto-shows on run` | Invoke `sonicpi.run`. Verify Output channel is revealed. |
| `clear command empties log` | Append log entries, invoke clear. Verify channel is empty. |
