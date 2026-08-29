---
name: GitHub shell authentication
description: The reliable browser-based GitHub authentication path for shell pushes in this workspace.
---

When shell Git pushes reject credentials, authenticate with GitHub CLI using its browser flow, then configure Git to use the CLI credential helper before pushing.

**Why:** Replit’s general GitHub connection and the shell’s Git credential helper can be separate; authenticated API access does not necessarily update `git push`.

**How to apply:** Use `gh auth login --hostname github.com --git-protocol https --web`, complete the browser/device approval, run `gh auth setup-git`, and then retry `git push origin main`. Never paste a token into chat.