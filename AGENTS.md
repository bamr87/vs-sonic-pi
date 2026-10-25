<!-- kit: sdlc v0.1.0 · AGENTS.md is the CANONICAL agent instructions file (decision D4, UPS-AGENT-07/08).
     Keep these six `##` headings (UPS-AGENT-07 checks they exist, in any order; add your own headings as needed). CLAUDE.md is a pointer to this file and carries no rules of its own. -->

# vs-sonic-pi

## What this repo is

A VS Code extension for [Sonic Pi](https://sonic-pi.net): it talks to the Sonic Pi server over OSC (Open Sound Control) via UDP to run and stop code, and gives the editor language support (completions, hover, diagnostics, snippets), a log view and a status bar. TypeScript, bundled with esbuild, tested with Vitest. A change is done when `npm run lint`, `npm test` and `npm run build` pass and the extension still activates against a running Sonic Pi.

## Stack & commands

```bash
npm install
npm run build        # esbuild bundle → dist/extension.js
npm run watch        # rebuild on change
npm run lint         # eslint src/
npm test             # vitest run (unit + integration)
npm run package      # vsce package → .vsix
```

## Layout

| Path | What |
| --- | --- |
| `src/extension.ts` | Entry point |
| `src/connection/` | OscTransport, ConnectionManager, Heartbeat, PortDiscovery, DaemonSpawner |
| `src/commands/` | Run and Stop command handlers |
| `src/language/` | CompletionProvider, HoverProvider, DiagnosticsProvider, snippets |
| `src/config/` | ConfigManager, the one wrapper over the VS Code settings API |
| `src/log/`, `src/ui/` | LogManager and LogFormatter; status bar, tree views, webviews |
| `src/data/` | Static JSON: synths, samples, FX, scales, chords, notes, functions |
| `test/` | The Vitest suites |
| `docs/` | Architecture, module by module; the PRD is `docs/PRD.md` |
| `scripts/` | Data extraction and tutorial copy helpers (`npm run extract-data`, `npm run copy-tutorial`) |

Architecture detail and the per-module conventions are in [`.github/copilot-instructions.md`](.github/copilot-instructions.md); this file is the entry point.

## Conventions

- **Disposables:** push every subscription to `context.subscriptions`.
- **OSC:** all communication goes through `OscTransport`; never open raw UDP sockets.
- **Settings:** all access goes through `ConfigManager`; do not call `vscode.workspace.getConfiguration()` directly.
- **TypeScript:** strict mode; prefix unused parameters with `_`; `async/await` over raw promises.
- **Backlog of record:** GitHub Issues with the fleet labels. Pick up issues labelled `agent:ready`; never touch `agent:hold` or `human-review`.
- **Definition of Done:** the checklist in `.github/pull_request_template.md`. Every box is ticked before merge.
- **Commits:** Conventional Commits (`feat fix docs style refactor test chore perf ci build`). The PR title is the squash subject.
- **Branches:** `feature/`, `fix/`, `docs/`, `refactor/`, `test/` or `chore/` off `main`.
- **Changelog:** `CHANGELOG.md` is written by the release workflow from the PR titles. Never edit it, or a version number, by hand.
- **Never:** push to `main` directly, commit secrets, suppress type errors, leave empty exception handlers, or edit generated files by hand.

## Fleet context

Member of the bamr87 fleet. The standards live in the hub: <https://github.com/bamr87/bamr87/tree/main/specs> (the Universal Project Standard). Commit here first; the hub bumps its submodule pointer afterwards.

## Standard deviations

- UPS-REPO-02: tests live under `test/` (grandfathered), not `tests/`.

## Governance

Read [`docs/constitution.md`](docs/constitution.md) before changing anything: it is the highest-precedence rule set here and wins over this file when they disagree. It changes only through a numbered record in [`docs/amendments/`](docs/amendments/), ratified by the maintainer merging the PR; agents propose, never merge. Every user-facing feature has a stable id in [`features/features.yml`](features/features.yml) with `status`, location and the PRD requirement ids it serves; the PRD's "Feature catalog" block is generated from it (`python3 <bamr87/bamr87>/tools/governance_lint.py prd-sync . --write`; check with `… check .`). Never hand-edit that block or `CHANGELOG.md`.
