# Daemon Spawner & Port Discovery

**Modules:** `src/connection/DaemonSpawner.ts`, `src/connection/PortDiscovery.ts`  
**Phase:** Phase 1 (port discovery) / Phase 2 (daemon spawner)  
**Dependencies:** `ConfigManager`, Node.js `child_process`, `fs`, `path`

---

## Purpose

These two modules solve the problem of *finding* and optionally *starting* the Sonic Pi backend. Port Discovery determines which UDP ports the running Sonic Pi server is using. The Daemon Spawner can optionally start the Sonic Pi daemon process (`daemon.rb`) if the user wants the extension to manage the server lifecycle.

---

## Part 1: Port Discovery

### Problem

Sonic Pi v4 uses **dynamic port allocation**. The daemon discovers available ports at boot time and writes them to a port file. The extension cannot assume fixed ports (like 4557/4558) will always be correct — it needs to discover the actual ports in use.

### Discovery Strategy (Priority Order)

```
1. Read port file from disk
   └── Found? → use those ports
       └── Not found? ↓

2. Read user configuration (sonicpi.osc.*)
   └── Non-default values? → use those ports
       └── All defaults? ↓

3. If DaemonSpawner started the daemon → parse STDOUT
   └── Ports captured? → use those ports
       └── Not captured? ↓

4. Fall back to well-known defaults
   └── sendPort: 4557, listenPort: 4558
```

### Port File Location

Sonic Pi writes port information to files in the user's home directory:

| Platform | Path |
|----------|------|
| macOS | `~/.sonic-pi/log/spider.log` (contains port info) |
| Linux | `~/.sonic-pi/log/spider.log` |
| Windows | `%USERPROFILE%\.sonic-pi\log\spider.log` |

The extension also checks for a dedicated port file if Sonic Pi writes one (varies by version):

| File | Content |
|------|---------|
| `~/.sonic-pi/log/server-port.txt` | Single number: the server listen port |
| `~/.sonic-pi/log/gui-port.txt` | Single number: the GUI listen port |

### Public Interface

```typescript
interface PortMap {
  serverPort: number;     // extension sends commands here
  guiPort: number;        // extension listens on this port
  daemonPort: number;     // for keep-alive messages (may equal serverPort)
  scsynthPort: number;    // informational
  oscCuesPort: number;    // informational
}

interface PortDiscoveryOptions {
  config: SonicPiConfig;
  daemonStdout?: string;  // captured STDOUT from DaemonSpawner
}

/**
 * Discover the ports used by the running Sonic Pi server.
 * Tries multiple strategies in priority order.
 */
async function discoverPorts(options: PortDiscoveryOptions): Promise<PortMap>;
```

### Port File Parsing

The spider log or port files may contain lines like:

```
Ports: {:server_port=>51235, :gui_port=>51236, :scsynth_port=>51237, ...}
```

Or in newer versions, a TOML-style config. The parser handles both formats:

```typescript
function parsePortFile(content: string): Partial<PortMap> | null {
  // Try Ruby hash format: {:server_port=>51235, ...}
  const rubyMatch = content.match(/:server_port=>(\d+)/);
  if (rubyMatch) {
    return {
      serverPort: parseInt(rubyMatch[1]),
      guiPort: parseInt(content.match(/:gui_port=>(\d+)/)?.[1] ?? '0'),
      // ... other ports
    };
  }

  // Try simple single-number format (server-port.txt)
  const singlePort = content.trim();
  if (/^\d+$/.test(singlePort)) {
    return { serverPort: parseInt(singlePort) };
  }

  return null;
}
```

### Fallback Behavior

If no port file is found and the user hasn't overridden settings, the extension falls back to the classic defaults:

| Port | Default | Used for |
|------|---------|----------|
| `serverPort` | `4557` | Extension → Server commands |
| `guiPort` | `4558` | Server → Extension responses |
| `daemonPort` | `4557` | Keep-alive (same as server) |

These defaults work with older Sonic Pi versions and simple single-instance setups.

---

## Part 2: Daemon Spawner

### Problem

In Phase 1, the user must manually start the Sonic Pi application before using the extension. This is acceptable but inconvenient. The Daemon Spawner (Phase 2) allows the extension to start the Sonic Pi backend directly, without the Qt GUI.

### Prerequisites

- Sonic Pi must be **installed** on the system.
- The extension needs to know the **installation path** (configured via `sonicpi.sonicPiPath` or auto-detected).
- Ruby must be available (bundled with Sonic Pi on most platforms).

### Installation Path Detection

| Platform | Default install locations |
|----------|--------------------------|
| macOS | `/Applications/Sonic Pi.app/Contents/Resources/` |
| Windows | `C:\Program Files\Sonic Pi\` |
| Linux | `/usr/lib/sonic-pi/` or `/opt/sonic-pi/` or built from source |

The spawner checks these locations in order, then falls back to the user-configured `sonicpi.sonicPiPath`.

### Daemon Entry Point

The daemon is started by running:

```bash
ruby <sonic-pi-path>/app/server/ruby/bin/daemon.rb
```

The daemon:
1. Discovers available ports.
2. Starts the Tau (Erlang/BEAM) process.
3. Starts the Spider Server (Ruby).
4. Starts scsynth (SuperCollider).
5. Outputs port information to STDOUT.
6. Enters a keep-alive loop (zombie kill switch).

### Public Interface

```typescript
interface DaemonSpawnerOptions {
  sonicPiPath: string;
  onStdout: (data: string) => void;
  onStderr: (data: string) => void;
  onExit: (code: number | null) => void;
}

class DaemonSpawner implements Disposable {

  constructor(options: DaemonSpawnerOptions);

  /**
   * Start the daemon process.
   * Resolves when the daemon outputs port information.
   * Rejects if the daemon fails to start within a timeout.
   */
  start(): Promise<PortMap>;

  /** Kill the daemon process and all children. */
  stop(): void;

  /** Whether the daemon process is currently running. */
  isRunning(): boolean;

  dispose(): void;
}
```

### STDOUT Parsing

The daemon outputs port information during boot. The spawner captures STDOUT and parses it:

```
1. Spawn `ruby daemon.rb` as a child process.
2. Buffer STDOUT line by line.
3. Look for the port map line (regex: /Ports:\s*\{.*\}/ or similar).
4. Parse the port map.
5. Resolve the start() promise with the PortMap.
6. If no port map appears within 30s, reject with timeout error.
```

### Process Management

| Concern | Approach |
|---------|----------|
| **Child process cleanup** | On `stop()` or `dispose()`, send SIGTERM to the daemon. The daemon handles SIGTERM by shutting down Tau, Spider, and scsynth. |
| **Orphan prevention** | Register a handler for the VS Code extension host's `process.on('exit')` to kill the daemon if the extension crashes. |
| **Multiple instances** | Check if a daemon is already running (port file exists and ports are responsive) before spawning a new one. |
| **Platform differences** | On Windows, use `child_process.spawn` with `shell: true` and `taskkill` for cleanup. On macOS/Linux, use process groups and `SIGTERM`. |

### Zombie Kill Switch Interaction

Once the daemon is started by the extension, the Heartbeat module (see [02-connection-manager.md](./02-connection-manager.md)) must send `/daemon/keep-alive` every ~30 seconds. If the extension stops sending keep-alive messages (e.g., it crashes or the user closes VS Code), the daemon will self-terminate after ~90 seconds. This is a safety feature — it prevents orphaned server processes.

---

## Integration with ConnectionManager

The ConnectionManager uses both modules during `connect()`:

```
connect()
│
├── 1. PortDiscovery.discoverPorts(config)
│       ├── Try port file → found? use ports
│       ├── Try config overrides → non-default? use ports
│       └── Fall back to defaults
│
├── 2. Open OscTransport with discovered ports
│
├── 3. Send /ping, wait for /ack
│       └── If no /ack and DaemonSpawner is enabled:
│           ├── DaemonSpawner.start() → captures ports from STDOUT
│           ├── Re-open OscTransport with new ports
│           └── Retry /ping → /ack
│
└── 4. Connected (start heartbeat)
```

### Auto-Start Flow (Phase 2)

When the user presses F5 and Sonic Pi is not running:

```
1. ConnectionManager.connect()
2. PortDiscovery finds no port file → use defaults
3. /ping sent → no /ack (server not running)
4. Show notification: "Sonic Pi server not found. Start it?"
   ├── [Start Server] → DaemonSpawner.start()
   │   ├── Daemon boots, outputs ports
   │   ├── PortDiscovery reads STDOUT ports
   │   ├── Retry /ping → /ack received
   │   └── Connected
   ├── [Download Sonic Pi] → open browser to sonic-pi.net
   └── [Cancel] → stay Disconnected
```

---

## Error Scenarios

| Scenario | Behavior |
|----------|----------|
| Port file not found, no config override | Use defaults. If `/ping` fails, show "server not found" message. |
| Port file found but ports are stale | `/ping` will fail. Show "server not found" message. User restarts Sonic Pi. |
| `sonicPiPath` is wrong | DaemonSpawner fails to find `daemon.rb`. Show error: "Sonic Pi not found at {path}. Check `sonicpi.sonicPiPath` setting." |
| Daemon fails to boot | STDERR captured and shown to user. Common causes: Ruby not found, port conflict, SuperCollider not installed. |
| Daemon exits unexpectedly | `onExit` callback fires. ConnectionManager transitions to Disconnected. Notification shown. |

---

## Testing

### Unit Tests

| Test | Description |
|------|-------------|
| **PortDiscovery: reads port file** | Write a mock port file. Verify `discoverPorts()` returns correct PortMap. |
| **PortDiscovery: parses Ruby hash format** | Input: `{:server_port=>51235, :gui_port=>51236}`. Verify parsed correctly. |
| **PortDiscovery: parses single-number file** | Input: `"51235"`. Verify `serverPort` is 51235. |
| **PortDiscovery: falls back to config** | No port file. Config has custom ports. Verify config values used. |
| **PortDiscovery: falls back to defaults** | No port file, default config. Verify 4557/4558 returned. |
| **DaemonSpawner: start resolves with ports** | Mock child process that outputs port line. Verify `start()` resolves with PortMap. |
| **DaemonSpawner: start rejects on timeout** | Mock child process that never outputs ports. Verify `start()` rejects after timeout. |
| **DaemonSpawner: stop kills process** | Start daemon, call `stop()`. Verify child process killed. |
| **DaemonSpawner: handles daemon exit** | Mock child process that exits with code 1. Verify `onExit` called. |
| **DaemonSpawner: detects existing daemon** | Port file exists and `/ping` succeeds. Verify spawner does not start a new daemon. |
