---
description: "Use when: creating branches, writing commits, opening PRs, running tests, updating the changelog, or documenting changes for vs-sonic-pi. Covers the full contribution workflow — branching, committing, testing, pull requests, and documentation."
applyTo: "**"
---

# Contribution Workflow

## Branching

Create branches from `main` with a prefixed name:

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/` | New functionality | `feature/audio-waveform-view` |
| `fix/` | Bug fixes | `fix/heartbeat-timeout` |
| `docs/` | Documentation only | `docs/osc-transport-guide` |
| `chore/` | Maintenance, deps, CI | `chore/upgrade-esbuild` |

```bash
git checkout main && git pull
git checkout -b feature/<short-description>
```

## Commits

- Use **imperative mood**, present tense: "Add …", "Fix …", "Update …"
- Keep the subject line under 72 characters
- Reference issues when applicable: `Fix heartbeat timeout (#42)`
- One logical change per commit — don't bundle unrelated work

Good examples:
```
Add hover documentation for FX parameters
Fix heartbeat timeout on slow connections
Update README with new keybinding table
```

## Testing Before Push

Run the full verification suite before pushing:

```bash
npm run lint        # ESLint — must pass with zero errors
npm run build       # esbuild bundle — must succeed
npm test            # Vitest unit + integration — must pass
```

- Add or update tests for any changed behaviour — tests live in `test/unit/` and `test/integration/`
- Use Vitest (not Mocha). The `vscode` module is mocked via `test/__mocks__/vscode.ts`
- Manual testing: press **F5** in VS Code to launch the Extension Development Host and verify against a running Sonic Pi instance

## Pull Requests

1. Push your branch and open a PR targeting `main`
2. Fill out the PR template — include summary, related issue, change list, and testing checklist
3. Ensure CI passes (lint → build → test on Node 20 + 22)
4. Link the issue with `Closes #<number>` in the PR description
5. Update documentation if the change affects user-facing behaviour

### PR Checklist (from template)

- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds
- [ ] `npm test` passes
- [ ] Manually tested in Extension Development Host (if applicable)

## Changelog

Update `CHANGELOG.md` following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format under the `[Unreleased]` heading. Categorise entries as:

- **Added** — new features
- **Changed** — changes to existing functionality
- **Deprecated** — features that will be removed
- **Removed** — removed features
- **Fixed** — bug fixes
- **Security** — vulnerability patches

Each entry is a single line starting with `- `:

```markdown
## [Unreleased]

### Added

- Audio waveform visualisation in the sidebar
```

## Documentation

- Update `docs/` when changing architecture or module behaviour
- Update `README.md` when adding user-facing features, commands, or settings
- Architecture docs follow the numbered naming scheme: `docs/NN-topic.md`
- The `media/tutorial/` folder contains Sonic Pi tutorial content — do not edit directly; regenerate via `scripts/copy-tutorial.sh`

## Releases

Releases are triggered by pushing a semver tag:

```bash
git tag v0.2.0
git push origin v0.2.0
```

The release workflow packages and publishes to the VS Code Marketplace. Follow [Semantic Versioning](https://semver.org/): bump major for breaking changes, minor for features, patch for fixes.
