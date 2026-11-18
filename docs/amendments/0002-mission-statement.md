<!-- kit: governance v0.1.0 -->
# 0002 — Missions

- **Status:** proposed
- **Date:** 2026-11-16
- **Proposed by:** Grok Bot (agent), at the maintainer's request
- **Ratified by:**
- **Affects:** constitution §1; PRD §1.1; feature SONICPI-023
- **Supersedes:** none
- **Related:** [docs/PRD.md](../../docs/PRD.md) §1.1; feature SONICPI-023

## Context

Constitution §1 Mission was a product description (or, for a new constitution, had not been written yet), not a three-mission direction statement. The fleet now requires every repo's constitution §1 to be one direction statement followed by exactly three numbered missions, adopted through a numbered amendment the maintainer ratifies by merging. The maintainer asked for those missions to be comprehensive and epic: VS Sonic Pi as the ultimate open home for all things Sonic Pi in the editor. Mission 1 follows the maintainer's wording, adapted to this domain: provide data, tools, resources and transparency for all stakeholders, domain practitioners and the general public. The ambition is the direction, not a claim that the work is already finished. The missions are aligned with this repo's existing constitution and PRD.

## Amendment

Replace constitution §1 with the following, retitled **Missions**:

VS Sonic Pi's direction is to become the ultimate open home for all things Sonic Pi in the editor — data, tools, resources and transparency, gathered in one place that anyone can inspect and reuse.

1. **Provide data, tools, resources and transparency for all stakeholders, live-coding musicians, educators and the general public.** Performers, teachers, students and anyone writing music as code are first-class audiences. The aim is a shared, inspectable commons: the same extension, the same docs, and the same path from editor to sound for everyone.
2. **Give Sonic Pi a first-class home inside Visual Studio Code, equivalent in capability to the native GUI for writing, running and live-coding music, while talking to the existing Sonic Pi server over its OSC API.** Users should be able to code in VS Code and still keep full compatibility with Sonic Pi's language, synths, samples and live loops.
3. **Teach that practice in the open: IntelliSense, hover docs, a built-in tutorial, and clear OSC control, so a newcomer can learn and a performer can play without leaving the editor.** The extension should be a studio and a classroom, not only a transport to the server.

These missions set the course; they do not claim the work is finished. They serve the PRD's goal of a first-class Sonic Pi experience inside Visual Studio Code, communicating with the existing Ruby and SuperCollider server via OSC.

_Source: [PRD.md](PRD.md) §1.1._


## Consequences

Agents and reviewers judge fit against these three missions before inventing scope, treating them as the direction of the repo rather than a description of what already ships. The same text is added as PRD §1.1 so the constitution's `_Source:` line stays accurate. The original PRD purpose / overview paragraph is left in place. This PR also aligns the README and AGENTS.md taglines with the missions and links them to constitution §1, and adds feature SONICPI-023 to the feature catalog, traced to requirement MR1. Merging this PR ratifies amendment 0002. Until then the record stays `Status: proposed`.
