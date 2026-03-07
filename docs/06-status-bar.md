# Status Bar Manager

**Module:** `src/ui/StatusBarManager.ts`  
**Phase:** 1 (MVP)  
**Dependencies:** `ConnectionManager`

---

## Purpose

The Status Bar Manager provides a persistent, at-a-glance indicator of the extension's connection state in the VS Code status bar. It tells the user whether Sonic Pi is connected, connecting, or disconnected — and provides a one-click action to connect or disconnect.

---

## Responsibilities

1. **Create** a `vscode.StatusBarItem` positioned on the left side of the status bar.
2. **Subscribe** to `ConnectionManager.onDidChangeState` and update the item on every transition.
3. **Map** each connection state to an icon, label, tooltip, and click command.
4. **Dispose** the status bar item when the extension deactivates.

---

## Public Interface

```typescript
import { Disposable } from 'vscode';

class StatusBarManager implements Disposable {

  constructor(connectionManager: ConnectionManager);

  /** Force a refresh of the status bar item (e.g., after config change). */
  refresh(): void;

  /** Remove the status bar item. */
  dispose(): void;
}
```

The StatusBarManager is largely self-managing. After construction, it subscribes to state changes and updates itself automatically.

---

## State → Display Mapping

| Connection State | Icon | Text | Tooltip | Click Command |
|------------------|------|------|---------|---------------|
| `Disconnected` | `$(circle-slash)` | `Sonic Pi` | "Sonic Pi: Disconnected — Click to connect" | `sonicpi.connect` |
| `Connecting` | `$(sync~spin)` | `Sonic Pi` | "Sonic Pi: Connecting..." | *(none)* |
| `Connected` | `$(check)` | `Sonic Pi` | "Sonic Pi: Connected on port {serverPort} — Click to disconnect" | `sonicpi.disconnect` |
| `Disconnecting` | `$(sync~spin)` | `Sonic Pi` | "Sonic Pi: Disconnecting..." | *(none)* |

### Icon Reference

VS Code uses [Codicons](https://microsoft.github.io/vscode-codicons/dist/codicon.html) for status bar icons:

- `$(circle-slash)` — a circle with a slash (indicates "off" or "blocked")
- `$(sync~spin)` — a spinning sync icon (indicates "in progress")
- `$(check)` — a checkmark (indicates "good" or "active")

The `~spin` modifier on `$(sync)` adds a CSS spin animation.

---

## Implementation Detail

```typescript
class StatusBarManager implements Disposable {
  private item: vscode.StatusBarItem;
  private disposables: Disposable[] = [];

  constructor(private cm: ConnectionManager) {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100, // priority — higher = further left
    );

    this.disposables.push(
      cm.onDidChangeState(() => this.refresh()),
    );

    this.refresh();
    this.item.show();
  }

  refresh(): void {
    const state = this.cm.getState();
    const info = this.cm.getInfo();

    switch (state) {
      case ConnectionState.Disconnected:
        this.item.text = '$(circle-slash) Sonic Pi';
        this.item.tooltip = 'Sonic Pi: Disconnected — Click to connect';
        this.item.command = 'sonicpi.connect';
        this.item.backgroundColor = undefined;
        break;

      case ConnectionState.Connecting:
        this.item.text = '$(sync~spin) Sonic Pi';
        this.item.tooltip = 'Sonic Pi: Connecting...';
        this.item.command = undefined;
        this.item.backgroundColor = undefined;
        break;

      case ConnectionState.Connected:
        this.item.text = '$(check) Sonic Pi';
        this.item.tooltip = `Sonic Pi: Connected on port ${info.ports?.serverPort} — Click to disconnect`;
        this.item.command = 'sonicpi.disconnect';
        this.item.backgroundColor = undefined;
        break;

      case ConnectionState.Disconnecting:
        this.item.text = '$(sync~spin) Sonic Pi';
        this.item.tooltip = 'Sonic Pi: Disconnecting...';
        this.item.command = undefined;
        this.item.backgroundColor = undefined;
        break;
    }
  }

  dispose(): void {
    this.item.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}
```

---

## Placement & Priority

The status bar item is placed on the **left** side with a priority of **100**. This puts it in a prominent but not intrusive position, typically near other language/tool indicators. The priority can be adjusted if it conflicts with other extensions.

---

## Error State (Future Enhancement)

In a future version, the status bar could show an error state when the last connection attempt failed:

| State | Icon | Text | Background |
|-------|------|------|------------|
| `Error` | `$(error)` | `Sonic Pi` | `statusBarItem.errorBackground` |

This would use VS Code's built-in error background color to draw attention. For MVP, connection errors are shown via notification messages instead.

---

## Testing

### Unit Tests (`test/unit/StatusBarManager.test.ts`)

| Test | Description |
|------|-------------|
| `shows disconnected state initially` | Create manager with Disconnected state. Verify text, tooltip, and command. |
| `updates on state change to Connected` | Emit Connected state. Verify icon changes to checkmark, tooltip includes port. |
| `updates on state change to Connecting` | Emit Connecting state. Verify spinner icon, no click command. |
| `click command is connect when disconnected` | Verify `item.command` is `sonicpi.connect`. |
| `click command is disconnect when connected` | Verify `item.command` is `sonicpi.disconnect`. |
| `dispose removes item` | Call dispose. Verify `item.dispose()` was called. |
