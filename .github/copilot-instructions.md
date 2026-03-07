# Copilot Instructions — vs-sonic-pi

## Project

VS Code extension for Sonic Pi. Communicates with the Sonic Pi server over OSC (Open Sound Control) via UDP. TypeScript, bundled with esbuild, tested with Vitest.

## Architecture

Entry point: `src/extension.ts`. Key modules:

- `src/connection/` — OscTransport, ConnectionManager, Heartbeat, PortDiscovery, DaemonSpawner
- `src/commands/` — Run, Stop command handlers
- `src/language/` — CompletionProvider, HoverProvider, DiagnosticsProvider, snippets
- `src/config/` — ConfigManager (wraps VS Code settings API)
- `src/log/` — LogManager, LogFormatter
- `src/ui/` — StatusBarManager, tree views, webviews
- `src/types/` — TypeScript interfaces for OSC and Sonic Pi types
- `src/data/` — Static JSON (synths, samples, FX, scales, chords, notes, functions)

## Conventions

- Use the **disposable pattern** — push all subscriptions to `context.subscriptions`
- All OSC communication goes through `OscTransport` — never open raw UDP sockets
- All settings access goes through `ConfigManager` — do not call `vscode.workspace.getConfiguration()` directly
- Prefix unused parameters with `_`
- Use `async/await` over raw promises
- Strict TypeScript (`strict: true` in tsconfig)

## Commands

- `npm run build` — esbuild bundle
- `npm run lint` — ESLint
- `npm test` — Vitest (unit + integration)
- `npm run package` — vsce package

## Testing

Tests in `test/unit/` and `test/integration/`. The `vscode` module is mocked via `test/__mocks__/vscode.ts`. Use Vitest, not Mocha.
