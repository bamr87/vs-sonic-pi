<!-- kit: governance v0.1.0 · seeded from bamr87/bamr87 templates/governance/. Owned by this repo after seeding;
     change it ONLY through an amendment record in docs/amendments/ (see § 8). Validate: python3 <hub>/tools/governance_lint.py check . -->
# vs-sonic-pi — Constitution

> The rules every change to this repo must satisfy, whoever makes it — a human or an AI agent.
> Agents read this before [AGENTS.md](../AGENTS.md) conventions, the [PRD](PRD.md), or the
> [feature catalog](../features/features.yml). Ratified by merged PR; amended only per § 8.

## 1. Missions

VS Sonic Pi's direction is to become the ultimate open home for all things Sonic Pi in the editor — data, tools, resources and transparency, gathered in one place that anyone can inspect and reuse.

1. **Provide data, tools, resources and transparency for all stakeholders, live-coding musicians, educators and the general public.** Performers, teachers, students and anyone writing music as code are first-class audiences. The aim is a shared, inspectable commons: the same extension, the same docs, and the same path from editor to sound for everyone.
2. **Give Sonic Pi a first-class home inside Visual Studio Code, equivalent in capability to the native GUI for writing, running and live-coding music, while talking to the existing Sonic Pi server over its OSC API.** Users should be able to code in VS Code and still keep full compatibility with Sonic Pi's language, synths, samples and live loops.
3. **Teach that practice in the open: IntelliSense, hover docs, a built-in tutorial, and clear OSC control, so a newcomer can learn and a performer can play without leaving the editor.** The extension should be a studio and a classroom, not only a transport to the server.

These missions set the course; they do not claim the work is finished. They serve the PRD's goal of a first-class Sonic Pi experience inside Visual Studio Code, communicating with the existing Ruby and SuperCollider server via OSC.

_Source: [PRD.md](PRD.md) §1.1._

## 2. Invariants (non-negotiable)

TBD — the agent guide states no explicit rules yet. Until it does, the fleet rules in § 4 and § 6 apply.
- Secrets (tokens, API keys) are never printed, logged or committed. _(fleet rule)_
- `CHANGELOG.md`, when present, is not hand-edited once release-please owns it. _(fleet rule)_

## 3. Authority and precedence

When two documents disagree, the higher one wins and the lower one is fixed in the same PR:

1. This constitution (and its ratified amendments in [docs/amendments/](amendments/))
2. [AGENTS.md](../AGENTS.md) — how to work here (commands, conventions, Definition of Done)
3. The PRD ([`PRD.md`](PRD.md)) — what the product must do (requirement ids `FRn` / `NFRn`)
4. [features/features.yml](../features/features.yml) — what it does today (stable feature ids)
5. ADRs in `docs/adr/` (none yet) and specs — why and how a specific change was made
6. Code, tests, generated files

## 4. Roles: humans and AI agents

| Actor | May | May not |
| --- | --- | --- |
| Maintainer (human) | Ratify amendments, PRD changes and releases by merging PRs; change settings, secrets, branch protection | — |
| AI agent | Read this file first; open PRs on a branch with Conventional Commit titles; update the feature catalog, PRD block and docs in the same PR as the change; propose amendments | Merge its own PRs; push to the default branch; force-push; change repo settings or branch protection; print or commit secrets; invent features or requirements (unknown = **TBD**) |

## 5. How the artifacts relate

| Artifact | Answers | Owned by | Rule |
| --- | --- | --- | --- |
| `docs/constitution.md` | What must always hold | Maintainer | Changes only by amendment (§ 8) |
| `docs/amendments/NNNN-*.md` | How and why the rules changed | Proposer → maintainer | Append-only; ratified by merged PR |
| `AGENTS.md` / `CLAUDE.md` | How to work here | Repo | Must link this file; `CLAUDE.md` imports `@AGENTS.md` |
| PRD | What the product must do | Maintainer | Requirements carry stable ids (`FRn`, `NFRn`) |
| `features/features.yml` | What the product does, where, proven how | Repo | Every user-facing feature has an id, `status`, location and `prd:` refs |
| PRD "Feature catalog" block | PRD → feature trace | Generated | `governance_lint.py prd-sync`; never hand-edit |
| `docs/adr/NNNN-*.md` | Why a hard-to-reverse decision was made | Proposer | One ADR per decision; an amendment may cite one |
| `CHANGELOG.md` | What shipped | release-please | Generated from Conventional Commits; never hand-edit |

## 6. Change process

| Change | Required in the same PR |
| --- | --- |
| Typo, docs fix, refactor with no user-visible effect | Conventional Commit title |
| New or changed user-facing feature | Entry in `features/features.yml` (`status`, `link`/`docs`, `prd:`), regenerated PRD block |
| New or changed requirement | PRD edit with a new `FRn`/`NFRn` id (ids are never reused), feature `prd:` refs updated |
| Hard-to-reverse technical decision | ADR in `docs/adr/` |
| Change to this constitution | Amendment record in `docs/amendments/` (§ 8) |

## 7. Quality gates

Every PR passes the checks the repo's guide names:

- `python3 <bamr87/bamr87>/tools/governance_lint.py prd-sync . --write` _(AGENTS.md)_
- `npm run build` _(CONTRIBUTING.md)_
- `npm test` _(CONTRIBUTING.md)_
- `npm run test:watch` _(CONTRIBUTING.md)_
- `npm run lint` _(CONTRIBUTING.md)_
- `python3 <bamr87/bamr87>/tools/governance_lint.py check .` (feature catalog ↔ PRD, constitution, amendments)

## 8. Amendments

This constitution changes only through a numbered record in [docs/amendments/](amendments/) (`NNNN-kebab-slug.md`, copied from [0000-template.md](amendments/0000-template.md)):

1. **Propose** — open a PR that adds the record (`Status: proposed`) *and* the edit to this file it describes. Name what it affects: constitution sections, PRD requirement ids, feature ids.
2. **Review** — the maintainer reviews; an agent never approves or merges its own amendment.
3. **Ratify** — merging the PR ratifies it. The record says `Status: ratified` and `Ratified by:` the PR. A rejected or withdrawn PR keeps its record with that status; numbers are never reused.
4. **Supersede** — a later amendment may replace an earlier one; mark the old record `superseded by NNNN`.

Records are append-only history: fix a ratified rule with a new amendment, never by editing an old record. [0001](amendments/0001-ratify-constitution.md) ratifies this document.
