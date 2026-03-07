# OSC Transport Layer

**Module:** `src/connection/OscTransport.ts`  
**Phase:** 1 (MVP)  
**Dependencies:** `node-osc`, Node.js `dgram` (transitive)

---

## Purpose

The OSC Transport Layer is the lowest-level networking module in the extension. It owns all UDP communication with the Sonic Pi backend, providing a typed send/receive abstraction over raw OSC (Open Sound Control) messages. Every other module that needs to talk to Sonic Pi does so through this layer.

---

## Responsibilities

1. **Send** OSC messages to a configurable host and port (the Sonic Pi server).
2. **Receive** OSC messages by binding a UDP socket to a configurable local port.
3. **Dispatch** incoming messages to registered handlers by OSC address.
4. **Lifecycle** — open and close sockets cleanly; report binding errors.

The transport does *not* interpret message semantics. It does not know what `/run-code` means or what `/multi_message` contains. That logic belongs to the modules that register handlers (ConnectionManager, LogManager, DiagnosticsProvider, etc.).

---

## Public Interface

```typescript
import { Disposable } from 'vscode';

type OscArgument = string | number | Buffer;
type OscHandler = (args: OscArgument[]) => void;

interface OscTransportOptions {
  remoteHost: string;   // e.g. "127.0.0.1"
  remotePort: number;   // port the Sonic Pi server listens on
  localPort: number;    // port this transport binds to for incoming messages
}

class OscTransport implements Disposable {

  constructor(options: OscTransportOptions);

  /**
   * Open the UDP sockets. Binds the local listener.
   * Throws if the local port is already in use.
   */
  open(): Promise<void>;

  /**
   * Send an OSC message to the remote server.
   * No-op if the transport is not open.
   */
  send(address: string, ...args: OscArgument[]): void;

  /**
   * Register a handler for incoming messages matching the given OSC address.
   * Returns a Disposable that unregisters the handler when disposed.
   * Multiple handlers can be registered for the same address.
   */
  onMessage(address: string, handler: OscHandler): Disposable;

  /**
   * Register a handler for ALL incoming messages (wildcard).
   * Useful for debug logging.
   */
  onAnyMessage(handler: (address: string, args: OscArgument[]) => void): Disposable;

  /**
   * Close both sockets and unregister all handlers.
   * Safe to call multiple times.
   */
  dispose(): void;
}
```

---

## Internal Design

### Socket Management

The transport wraps two objects from `node-osc`:

| Object | Role | Lifecycle |
|--------|------|-----------|
| `osc.Client(remoteHost, remotePort)` | Sends UDP datagrams to the Sonic Pi server. | Created in constructor, usable after `open()`. |
| `osc.Server(localPort, '0.0.0.0')` | Binds a UDP socket and emits incoming OSC messages. | Created and bound during `open()`. |

### Handler Registry

Internally, handlers are stored in a `Map<string, Set<OscHandler>>`. When the `osc.Server` emits a `'message'` event, the transport:

1. Extracts the OSC address (first element of the message array).
2. Looks up all handlers registered for that address.
3. Calls each handler with the remaining arguments.
4. Also calls any wildcard (`onAnyMessage`) handlers.

```
Incoming UDP datagram
    │
    ▼
osc.Server 'message' event
    │
    ├── address = msg[0]       (e.g. "/ack")
    ├── args    = msg[1..]     (e.g. [])
    │
    ├── handlers.get(address)  → call each with args
    └── wildcardHandlers       → call each with (address, args)
```

### Error Handling

| Scenario | Behavior |
|----------|----------|
| Local port already in use | `open()` rejects with a descriptive error: `"Cannot bind to port {N}. It may be in use by the Sonic Pi GUI or another process."` |
| Send called before `open()` | Silently ignored (logged at debug level). |
| Send called after `dispose()` | Silently ignored. |
| UDP send error | Logged as warning. OSC over UDP is fire-and-forget; no retries at this layer. |
| Malformed incoming message | Logged as warning, handler not called. |

### Thread Safety

Node.js is single-threaded. All `osc.Server` events fire on the event loop. No additional synchronization is needed, but handlers must not block the event loop (no synchronous I/O or heavy computation).

---

## Configuration

The transport reads its options from the values passed by `ConnectionManager`, which in turn reads from `ConfigManager`:

| Option | Setting Key | Default |
|--------|-------------|---------|
| `remoteHost` | `sonicpi.osc.host` | `"127.0.0.1"` |
| `remotePort` | `sonicpi.osc.sendPort` | `4557` |
| `localPort` | `sonicpi.osc.listenPort` | `4558` |

---

## OSC Protocol Reference

The transport carries these messages. It does not interpret them — this table is for reference.

### Extension → Server (send)

| Address | Arguments | Caller |
|---------|-----------|--------|
| `/ping` | — | ConnectionManager |
| `/run-code` | `agentName: string`, `code: string` | CommandHandler (run selection) |
| `/save-and-run-buffer` | `filename: string`, `code: string`, `workspace: string` | CommandHandler (run buffer) |
| `/stop-all-jobs` | — | CommandHandler (stop) |
| `/save-buffer` | `filename: string`, `code: string` | CommandHandler (on save) |
| `/beautify-buffer` | — | CommandHandler (beautify) |
| `/start-recording` | — | CommandHandler (record) |
| `/stop-recording` | — | CommandHandler (record) |
| `/save-recording` | `filename: string` | CommandHandler (record) |
| `/daemon/keep-alive` | — | Heartbeat |
| `/exit` | — | ConnectionManager (on disconnect) |

### Server → Extension (receive)

| Address | Arguments | Consumer |
|---------|-----------|----------|
| `/ack` | — | ConnectionManager |
| `/multi_message` | `runId`, `threadName`, `timestamp`, N × (`type`, `text`) | LogManager |
| `/info` | `message: string` | LogManager |
| `/error` | `message: string` | LogManager, DiagnosticsProvider |
| `/replace-buffer` | `id`, `code`, `line`, `index`, `firstLineVisible` | CommandHandler (beautify response) |
| `/exited` | — | ConnectionManager |
| `/exited_with_boot_error` | `message: string` | ConnectionManager |

---

## Lifecycle

```
  ConnectionManager calls:

  1. new OscTransport({ remoteHost, remotePort, localPort })
  2. transport.open()          ← binds UDP socket
  3. transport.onMessage(...)  ← register handlers
  4. transport.send(...)       ← send messages
     ...
  5. transport.dispose()       ← close sockets, clear handlers
```

The transport is created and destroyed by `ConnectionManager`. It is **not** a singleton — a new instance is created for each connection attempt, ensuring clean socket state.

---

## Testing

### Unit Tests (`test/unit/OscTransport.test.ts`)

| Test | Description |
|------|-------------|
| `send delivers message` | Create transport with mock client. Call `send('/ping')`. Verify mock received the message. |
| `onMessage dispatches to handler` | Simulate incoming `/ack` on mock server. Verify registered handler is called with correct args. |
| `onMessage ignores unregistered addresses` | Simulate incoming `/foo`. Verify no handler called, no error thrown. |
| `multiple handlers for same address` | Register two handlers for `/info`. Simulate message. Verify both called. |
| `dispose unregisters handler` | Register handler, dispose it, simulate message. Verify handler not called. |
| `open rejects on port conflict` | Mock `osc.Server` to throw EADDRINUSE. Verify `open()` rejects with descriptive error. |
| `send after dispose is no-op` | Dispose transport, call `send()`. Verify no error, no message sent. |
| `onAnyMessage receives all` | Register wildcard handler. Simulate `/ack` and `/info`. Verify handler called for both. |

### Integration Notes

Integration tests in `test/integration/extension.test.ts` will spin up a mock OSC server on a free port and verify round-trip send/receive through a real `OscTransport` instance.
