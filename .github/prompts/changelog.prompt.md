---
description: "Add a changelog entry to CHANGELOG.md under [Unreleased] following Keep a Changelog format."
agent: "agent"
argument-hint: "Describe the change and its category (Added, Changed, Fixed, etc.)"
---

Follow the [contribution workflow](./../instructions/contribution-workflow.instructions.md).

Add an entry to `CHANGELOG.md`:

1. Read the current `CHANGELOG.md` to find the `[Unreleased]` section.
2. Determine the correct category: **Added**, **Changed**, **Deprecated**, **Removed**, **Fixed**, or **Security**.
3. If the category heading doesn't exist under `[Unreleased]` yet, create it.
4. Write a single-line entry starting with `- ` that concisely describes the change.
5. If no description is given, inspect recent commits or staged changes to infer the entry.
