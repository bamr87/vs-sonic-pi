# Connection Manager

> `ConnectionManager`, the state machine for the connection lifecycle (Disconnected → Connecting → Connected → Disconnecting) that orchestrates port discovery, handshake, heartbeat and health monitoring.

**Module:** `src/connection/ConnectionManager.ts`  
**Phase:** 1 (MVP)  
**Dependencies:** `OscTransport`, `Heartbeat`, `PortDiscovery`, `ConfigManager`

---

## Purpose

The Connection Manager is the central orchestrator for the extension's relationship with the Sonic Pi backend. It owns the connection state machine, coordinates port discovery, manages the OSC transport lifecycle, and keeps the daemon alive via heartbeat. Every other module queries or subscribes to the Connection Manager to know whether Sonic Pi is reachable.

---

## Responsibilities

1. **State machine** — Maintain the connection lifecycle (`Disconnected` → `Connecting` → `Connected` → `Disconnecting`).
2. **Port discovery** — Determine which ports the Sonic Pi server is using.
3. **Handshake** — Send `/ping`, wait for `/ack`, with retry logic.
4. **Heartbeat** — Start and stop the keep-alive timer that prevents the daemon's zombie kill switch.
5. **Health monitoring** — Detect unexpected disconnects and transition state accordingly.
6. **Event emission** — Notify subscribers (StatusBar, CommandHandler, etc.) of state changes.

---

## Public Interface

```typescript
import { Disposable, EventEmitter, Event } from 'vscode';

enum ConnectionState {
  Disconnected  = 'disconnected',
  Connecting    = 'connecting',
  Connected     = 'connected',
  Disconnecting = 'disconnecting',
}

interface ConnectionInfo {
  state: ConnectionState;
  ports: PortMap | null;
  lastAck: Date | null;
  error: string | null;
}

interface PortMap {
  serverPort: number;
  guiPort: number;
  scsynthPort: number;
  oscCuesPort: number;
  daemonPort: number;
}

class ConnectionManager implements Disposable {

  readonly onDidChangeState: Event<ConnectionState>;

  /** Current connection state. */
  getState(): ConnectionState;

  /** Full connection info including ports and last ack time. */
  getInfo(): ConnectionInfo;

  /** The underlying transport (null when disconnected). */
  getTransport(): OscTransport | null;

  /**
   * Initiate connection to Sonic Pi.
   * Discovers ports, opens transport, performs handshake.
   * Resolves when Connected; rejects if handshake fails.
   */
  connect(): Promise<void>;

  /**
   * Gracefully disconnect.
   * Stops heartbeat, closes transport, transitions to Disconnected.
   */
  disconnect(): Promise<void>;

  /** Clean up all resources. */
  dispose(): void;
}
```

---

## State Machine

```
                     ┌───────────────┐
          ┌──────────│ Disconnected  │◄─────────────────────────┐
          │          └───────┬───────┘                          │
          │                  │                                  │
          │     connect() called                     timeout / error /
          │     or auto-connect                      /exited received /
          │                  │                       handshake failed
          │                  ▼                                  │
          │          ┌───────────────┐                          │
          │          │  Connecting   │                          │
          │          │               │                          │
          │          │ 1. Discover   │──── all retries fail ────┘
          │          │    ports      │
          │          │ 2. Open       │
          │          │    transport  │
          │          │ 3. Send /ping │
          │          │ 4. Wait /ack  │
          │          │    (retry ×5) │
          │          └───────┬───────┘
          │                  │
          │           /ack received
          │                  │
          │                  ▼
          │          ┌───────────────┐
          │          │  Connected    │──── /exited or health ───┐
          │          │               │     check fails          │
          │          │ • Heartbeat   │                          │
          │          │   running     │                          │
          │          │ • Commands    │                          │
          │          │   enabled     │                          │
          │          │ • Log stream  │                          │
          │          │   active      │                          │
          │          └───────┬───────┘                          │
          │                  │                                  │
          │         disconnect() called                        │
          │                  │                                  │
          │                  ▼                                  │
          │          ┌───────────────┐                          │
          └─────────►│ Disconnecting │──────────────────────────┘
                     │               │
                     │ 1. Stop       │
                     │    heartbeat  │
                     │ 2. Send /exit │
                     │ 3. Close      │
                     │    transport  │
                     └───────────────┘
```

### State Descriptions

| State | What is happening | Commands allowed |
|-------|-------------------|------------------|
| **Disconnected** | No active connection. Transport is null. | `connect`, `openExamples` |
| **Connecting** | Port discovery in progress, transport opening, `/ping` sent, waiting for `/ack`. | — (queued) |
| **Connected** | Active session. Heartbeat running. Transport open and healthy. | All commands |
| **Disconnecting** | Tearing down. Heartbeat stopped, transport closing. | — |

### Transitions

| From | To | Trigger |
|------|----|---------|
| Disconnected | Connecting | `connect()` called (user or auto-connect) |
| Connecting | Connected | `/ack` received |
| Connecting | Disconnected | All retries exhausted or port bind failure |
| Connected | Disconnecting | `disconnect()` called |
| Connected | Disconnected | `/exited` received or health check fails |
| Disconnecting | Disconnected | Teardown complete |

---

## Connection Sequence (Detail)

### connect()

```
1. Transition to Connecting
2. Discover ports (PortDiscovery)
   ├── Try reading port file (~/.sonic-pi/log/)
   ├── Fall back to user config (sonicpi.osc.*)
   └── Fall back to defaults (4557/4558)
3. Create new OscTransport(ports)
4. transport.open()
   └── If EADDRINUSE → reject with clear message, transition to Disconnected
5. Register message handlers:
   ├── /ack           → resolve handshake
   ├── /multi_message → forward to LogManager
   ├── /info          → forward to LogManager
   ├── /error         → forward to LogManager + DiagnosticsProvider
   ├── /replace-buffer → forward to CommandHandler
   ├── /exited        → transition to Disconnected
   └── /exited_with_boot_error → transition to Disconnected + show error
6. Send /ping
7. Wait for /ack (timeout: 2s)
   ├── If received → transition to Connected, start Heartbeat
   └── If timeout  → retry (up to 5 times, 1s apart)
       └── If all retries fail → dispose transport, transition to Disconnected
```

### disconnect()

```
1. Transition to Disconnecting
2. Stop Heartbeat
3. Send /exit (best-effort, don't wait for response)
4. transport.dispose()
5. Set transport to null
6. Transition to Disconnected
```

---

## Health Monitoring

While in the `Connected` state, the Connection Manager periodically verifies the server is still alive:

| Mechanism | Interval | Behavior on failure |
|-----------|----------|---------------------|
| **Heartbeat** (outgoing) | Every 30 s | Sends `/daemon/keep-alive`. Failure to send (socket error) triggers disconnect. |
| **Liveness ping** (optional, Phase 2) | Every 60 s | Sends `/ping`, expects `/ack` within 5 s. If no response, transition to Disconnected and notify user. |
| **`/exited` listener** | Passive | If server sends `/exited` or `/exited_with_boot_error`, immediately transition to Disconnected. |

---

## Event Emission

The Connection Manager exposes a VS Code `Event<ConnectionState>` that other modules subscribe to:

```typescript
// StatusBarManager subscribes:
connectionManager.onDidChangeState((state) => {
  statusBar.update(state);
});

// CommandHandler subscribes:
connectionManager.onDidChangeState((state) => {
  const enabled = state === ConnectionState.Connected;
  vscode.commands.executeCommand('setContext', 'sonicpi.connected', enabled);
});
```

The `setContext` call enables VS Code's `when` clause system, so keybindings and menu items can be conditionally shown:

```jsonc
// package.json
{ "command": "sonicpi.run", "key": "f5", "when": "editorLangId == sonicpi && sonicpi.connected" }
```

---

## Auto-Connect Behavior

When `sonicpi.autoConnect` is `true` (default):

1. On extension activation (triggered by opening a `.spi` file), the Connection Manager automatically calls `connect()`.
2. If connection fails, it does **not** retry automatically — it shows a notification and stays in `Disconnected`.
3. The user can manually retry via the status bar click or "Sonic Pi: Connect" command.

When `sonicpi.autoConnect` is `false`:

1. Extension activates but stays in `Disconnected`.
2. User must explicitly connect via command or status bar.

---

## Error Messages

| Scenario | User-facing message |
|----------|---------------------|
| Port in use | "Cannot connect: port {N} is in use. Close the Sonic Pi application or change `sonicpi.osc.listenPort` in settings." |
| Handshake timeout | "Cannot reach Sonic Pi server. Make sure Sonic Pi is running and try again." |
| Server exited | "Sonic Pi server has disconnected." |
| Boot error | "Sonic Pi server failed to start: {message}" |

---

## Testing

### Unit Tests (`test/unit/ConnectionManager.test.ts`)

| Test | Description |
|------|-------------|
| `starts in Disconnected` | New instance has state `Disconnected`, transport is null. |
| `connect transitions to Connecting then Connected` | Mock transport and `/ack` response. Verify state transitions and event emissions. |
| `connect retries on timeout` | Mock transport with no `/ack`. Verify `/ping` sent 5 times. Verify final state is `Disconnected`. |
| `connect rejects on port conflict` | Mock transport `open()` to throw. Verify state returns to `Disconnected` with error message. |
| `disconnect transitions to Disconnecting then Disconnected` | From Connected, call `disconnect()`. Verify heartbeat stopped, transport disposed. |
| `/exited triggers disconnect` | From Connected, simulate `/exited` message. Verify state transitions to `Disconnected`. |
| `state change events fire` | Subscribe to `onDidChangeState`. Perform connect. Verify events for each transition. |
| `heartbeat starts on Connected` | Verify heartbeat `start()` called when entering Connected. |
| `heartbeat stops on disconnect` | Verify heartbeat `stop()` called when leaving Connected. |
| `auto-connect on activation` | With `autoConnect: true`, verify `connect()` called during activation. |
| `no auto-connect when disabled` | With `autoConnect: false`, verify `connect()` not called. |
