---
description: "Start a new contribution — create a branch, implement changes, run tests, commit, and prepare a PR. Full guided workflow."
agent: "agent"
argument-hint: "Describe the feature, fix, or change to implement"
---

Follow the [contribution workflow](./../instructions/contribution-workflow.instructions.md).

You are guiding a contribution to vs-sonic-pi end-to-end. Given the user's description of what to change:

1. **Branch** — Determine the correct prefix (`feature/`, `fix/`, `docs/`, `chore/`) and create the branch from `main`.
2. **Implement** — Make the code changes. Add or update Vitest tests in `test/unit/` or `test/integration/`.
3. **Verify** — Run `npm run lint`, `npm run build`, and `npm test`. Fix any failures before proceeding.
4. **Commit** — Write imperative-mood commit messages under 72 characters. One logical change per commit. Reference issues when applicable.
5. **Changelog** — Add an entry to `CHANGELOG.md` under `[Unreleased]` with the correct category (Added/Changed/Fixed/etc.).
6. **Documentation** — Update `docs/` or `README.md` if the change affects user-facing behaviour.
7. **PR prep** — Draft a PR description using the project's PR template with summary, related issue, change list, and testing checklist.

Open the PR as **draft** if the work is still in progress.
