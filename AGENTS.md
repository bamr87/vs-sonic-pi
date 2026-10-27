<!-- kit: sdlc v0.1.0 · AGENTS.md is the CANONICAL agent instructions file (decision D4, UPS-AGENT-07/08). -->

# vs-sonic-pi

> Sonic Pi for VS Code, an extension to write and perform Sonic Pi music live over OSC — the commands, layout, conventions and module rules for working on it.

## What this repo is

**Sonic Pi for VS Code** (package `vs-sonic-pi`) lets musicians and live coders write and perform [Sonic Pi](https://sonic-pi.net) code from VS Code: `.spi` language support (TextMate grammar, snippets, completions and hover docs built from `src/data/sonic-pi-data.json`), Run / Run Selection / Stop over OSC to a running Sonic Pi server, a per-`live_loop` CodeLens, inline diagnostics, the built-in tutorial (`media/tutorial/`), bundled examples (`examples/`), audio recording, and a Codespaces devcontainer that builds a headless Sonic Pi server and streams its audio. The entry point is `src/extension.ts`; the extension is bundled with esbuild and tested with Vitest against a mocked `vscode` module.

"Done" means `npm run lint`, `npm run build` and `npm test` pass (the checklist in `.github/pull_request_template.md`), `docs/reference/` is regenerated when `package.json` `contributes` changed, and a user-visible change has been tried in the Extension Development Host where that is possible.

## Stack & commands

TypeScript (strict) on Node ≥ 20, VS Code `^1.109.0`; esbuild bundles to `dist/extension.js`; Vitest runs `test/unit/` and `test/integration/` with `vscode` aliased to `test/__mocks__/vscode.ts`.

```bash
npm install                  # install dependencies (Node >= 20; CI runs npm ci on Node 20 and 22)
npm run build                # esbuild bundle → dist/extension.js; then F5 ("Run Extension") opens the Extension Development Host
npm run watch                # rebuild on change
npm run lint                 # eslint src/
npm test                     # vitest run: unit + integration, plus the docs/reference freshness check
npm run test:watch           # vitest in watch mode
npm run docs:reference       # regenerate docs/reference/*.md from package.json contributes
npm run package              # vsce package → .vsix (needs @vscode/vsce on PATH, as release.yml installs it)
SONIC_PI_PATH=/path/to/sonic-pi npm run extract-data   # regenerate src/data/sonic-pi-data.json from a Sonic Pi checkout
SONIC_PI_PATH=/path/to/sonic-pi npm run copy-tutorial  # refresh media/tutorial/ from a Sonic Pi checkout
```

Docs gates: `python3 tools/unwrap-prose.py --check` (one paragraph per line; CI repairs a PR branch itself) and `python3 tools/docs_index.py --check` (the `docs/README.md` index).

## Layout

| Path | What lives there |
| --- | --- |
| `src/` | Extension source: `extension.ts` (activation, wiring), `connection/` (OscTransport, ConnectionManager, Heartbeat, PortDiscovery, DaemonSpawner), `commands/`, `language/` (completions, hover, diagnostics, `live_loop` CodeLens, `snippets.json`), `config/`, `log/`, `ui/` (status bar, tree views, webviews), `types/`, `data/` |
| `test/` | Vitest suites: `unit/`, `integration/`, and the `vscode` mock in `__mocks__/` |
| `syntaxes/`, `language-configuration.json` | The Sonic Pi TextMate grammar and editor behaviour |
| `media/tutorial/` | The Sonic Pi tutorial chapters (CC BY-SA 4.0, copied by `npm run copy-tutorial`) |
| `examples/` | Bundled `.spi` examples, one folder per difficulty |
| `docs/` | Docs index, user manual, architecture overview, numbered component designs, and generated reference (`docs/reference/`) |
| `scripts/` | `extract-sonic-pi-data.ts`, `copy-tutorial.sh`, `gen-reference-docs.mjs` |
| `tools/` | Vendored fleet tools (`unwrap-prose.py`, `docs_index.py`) |
| `.devcontainer/` | The Codespaces image: Sonic Pi server, SuperCollider, PulseAudio/JACK and the ffmpeg audio stream |
| `.github/` | CI, release and `@claude` workflows; Copilot instructions, agents and prompts; issue and PR templates |

## Conventions

- **Backlog of record:** GitHub Issues (no file backlog). Use the bug report and feature request templates.
- **Definition of Done:** the checklist in `.github/pull_request_template.md` (lint, build, test, manual check in the Extension Development Host), plus the "done" bar above.
- **Decisions:** a decision that is hard to reverse gets an ADR at `docs/adr/NNNN-slug.md`, indexed in [`docs/adr/README.md`](docs/adr/README.md) (UPS-WORK-04).
- **Commits:** imperative subject under 72 characters, one logical change per commit, issues referenced as `(#N)` ([CONTRIBUTING.md](CONTRIBUTING.md)); recent history uses Conventional Commit prefixes (`docs(readme): …`, `ci: …`, `chore(deps): …`).
- **Branches:** `feature/`, `fix/`, `docs/` or `chore/` off `main`; open a pull request, never push to `main` directly.
- **Changelog and releases:** `CHANGELOG.md` is kept by hand in Keep a Changelog format — add entries under `[Unreleased]`. Pushing a `v*` tag runs `.github/workflows/release.yml`, which builds, tests, packages and publishes to the Marketplace with the `VSCE_PAT` secret.
- **Generated, never hand-edited:** `docs/reference/{commands,settings,keybindings}.md` (`npm run docs:reference`; `test/unit/referenceDocs.test.ts` fails `npm test` while they are stale), `src/data/sonic-pi-data.json` (`npm run extract-data`), `media/tutorial/` (`npm run copy-tutorial`), and the `docs/README.md` index span (`python3 tools/docs_index.py --write`).
- **Vendored, never edited here:** `tools/unwrap-prose.py`, `tools/docs_index.py` — change them in the hub and re-vendor.
- **Code style:** strict TypeScript, ESLint (`eslint.config.mjs`, scoped to `src/`), Prettier (`.prettierrc`); prefer `async`/`await`; prefix unused parameters with `_`.
- **Markdown** is one paragraph per line (`python3 tools/unwrap-prose.py --write`).
- **Never:** suppress type errors (`as any`, `@ts-ignore`), leave empty exception handlers, or commit secrets.

## Module rules

- **Disposable pattern:** every module implements `vscode.Disposable`; push every subscription, timer and listener to `context.subscriptions` or dispose it in the owner's `dispose()`.
- All OSC traffic goes through `OscTransport` (`src/connection/OscTransport.ts`) — never open raw UDP sockets.
- All settings access goes through `ConfigManager` (`src/config/ConfigManager.ts`) — never call `vscode.workspace.getConfiguration()` elsewhere. It clamps and validates values at read time.
- Commands that talk to the server go through `withConnectionGuard` in `src/commands/index.ts`, which offers **Connect** when the extension is disconnected instead of failing silently; wrap new ones the same way ([docs/03-command-handler.md](docs/03-command-handler.md)).
- The extension only talks to a Sonic Pi server on the configured host (default `127.0.0.1`); it makes no other network connections ([SECURITY.md](SECURITY.md)).
- Language data (synths, samples, FX, scales, chords, functions) comes from `src/data/sonic-pi-data.json`; regenerate it from the Sonic Pi source rather than editing it.
- The component designs are in `docs/` — start with [docs/00-architecture.md](docs/00-architecture.md); [docs/PRD.md](docs/PRD.md) holds the product requirements.

## Fleet context

Member of the bamr87 fleet, managed by the [bamr87/bamr87 hub](https://github.com/bamr87/bamr87) (registry `_data/projects.yml`; standards in [`specs/`](https://github.com/bamr87/bamr87/tree/main/specs), the Universal Project Standard). It is vendored there as a git submodule (`projects/vs-sonic-pi`): commit and push changes **here** first — the hub only bumps its pointer afterwards. Shared CI, release, schema, and agent kits are seeded from the hub's `templates/`; prefer adopting those over hand-rolling equivalents. Loops that act on this repo: the shared CI gate (`ci.yml`, a thin caller of the hub's `standard-ci.yml` over Node 20 and 22), the self-healing markdown one-line gate (`markdown-oneline.yml`), `@claude` mentions (`claude.yml`), the tag-driven Marketplace release (`release.yml`), and the hub's fan-out pull requests.

## Standard deviations

- UPS-REPO-02: tests live under `test/` (grandfathered), not `tests/`.

## Governance

Read [`docs/constitution.md`](docs/constitution.md) before changing anything: it is the highest-precedence rule set here and wins over this file when they disagree. It changes only through a numbered record in [`docs/amendments/`](docs/amendments/), ratified by the maintainer merging the PR; agents propose, never merge. Every user-facing feature has a stable id in [`features/features.yml`](features/features.yml) with `status`, location and the PRD requirement ids it serves; the PRD's "Feature catalog" block is generated from it (`python3 <bamr87/bamr87>/tools/governance_lint.py prd-sync . --write`; check with `… check .`). Never hand-edit that block or `CHANGELOG.md`.
