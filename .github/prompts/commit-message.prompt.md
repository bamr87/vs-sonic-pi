---
description: "Write a commit message for staged changes following vs-sonic-pi conventions."
agent: "agent"
argument-hint: "Optionally describe what changed, or let the agent inspect staged diffs"
---

Follow the [contribution workflow](./../instructions/contribution-workflow.instructions.md).

Write a commit message for the current staged changes:

1. Run `git diff --cached --stat` and `git diff --cached` to inspect what's staged.
2. Write a message using **imperative mood**, present tense ("Add …", "Fix …", "Update …").
3. Keep the subject line under **72 characters**.
4. Reference the related issue number if known (e.g., `Fix heartbeat timeout (#42)`).
5. If there are multiple unrelated changes staged, suggest splitting into separate commits — one logical change per commit.
6. Present the final message and ask for confirmation before committing.
