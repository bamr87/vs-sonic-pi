---
description: "Draft a pull request description using the vs-sonic-pi PR template."
agent: "agent"
argument-hint: "Describe what the PR does, or let the agent inspect the branch diff"
---

Follow the [contribution workflow](./../instructions/contribution-workflow.instructions.md).

Draft a PR description for the current branch:

1. Run `git log main..HEAD --oneline` to see commits on this branch.
2. Run `git diff main --stat` to summarise changed files.
3. Fill out the PR template:
   - **Summary** — brief description of the changes
   - **Related Issue** — `Closes #<number>` if applicable
   - **Changes** — bullet list of what was done
   - **Testing** — check off applicable items:
     - [ ] `npm run lint` passes
     - [ ] `npm run build` succeeds
     - [ ] `npm test` passes
     - [ ] Manually tested in Extension Development Host (if applicable)
4. If the work is still in progress, note that the PR should be opened as **draft**.
5. Present the description for review before the user opens the PR.
