---
name: learn
description: Analyzes recent changes and conversation to create or update .claude/ rules, skills, and commands based on identified patterns
---

# `/learn` — single workflow

**Goal:** infer **rules / skills / commands** from the **Git delta since the last `/learn`** plus the **current conversation**, without processing the same commits twice.

**`.claude/gitanchor`** holds **one line**: the SHA of the last commit already covered. Everything **after** that SHA (`<ANCHOR>..HEAD`) is this run’s Git scope.

---

## `.claude/` language policy (canonical)

- All **authored** content under `.claude/` (rules, commands, skills, hooks, and any docs in that tree) must be **English**.
- **Exception:** the **chat summary** you post after this workflow may be **French** (team preference). Any **files** you create or edit under `.claude/` during `/learn` (including rules, commands, skills) stay **English**.

---

## 0. Git commands in the agent terminal (required)

The integrated agent shell often starts with **`cwd` outside this repo** (e.g. `/private/tmp`). Plain `git rev-parse` / `git log` then fail with “not a git repository”, and `cd <repo> && git …` can fail under sandbox.

**Always** run Git **one** of these ways:

1. **Preferred:** use the terminal tool with **`working_directory`** set to **this repository root** (the folder that contains `.git`).
2. **Alternative:** use an explicit Git tree:  
   `git -C /absolute/path/to/repo <subcommand>`  
   (use the real absolute path to this repo on the machine).

Examples (after choosing 1 or 2):

```bash
git rev-parse --verify "${ANCHOR}^{commit}" 2>/dev/null
git merge-base --is-ancestor "${ANCHOR}" HEAD
git log "${ANCHOR}..HEAD" --oneline
git diff "${ANCHOR}..HEAD" --stat
```

Bootstrap / fallback (no usable anchor):

```bash
git log -12 --oneline
git diff HEAD~10..HEAD --stat
```

Do **not** assume the shell already `cd`’d into the repo.

---

## 1. Determine the Git scope

**1.1** Read `.claude/gitanchor` (trim; ignore empty lines and `#` comments). If missing, empty, or not a plausible Git SHA → **bootstrap** (go to **1.4**).

**1.2** If an anchor exists: run `git rev-parse --verify <ANCHOR>^{commit}`; then `git merge-base --is-ancestor <ANCHOR> HEAD` (with **§0** applied). If the anchor is not an ancestor of `HEAD` (rebase, rewritten history) → **bootstrap** (note in the report that the anchor was invalidated).

**1.3** Incremental delta:

- `git log <ANCHOR>..HEAD --oneline`
- `git diff <ANCHOR>..HEAD --stat`

If the range is **empty** (no new commits), say so explicitly; you may still use the **conversation** for the rest.

**1.4** Bootstrap (no usable anchor):

- `git diff HEAD~10..HEAD --stat` (adjust if the repo has fewer than 10 commits)
- `git log -10 --oneline` if helpful

---

## 2. Analyze

From the **diff / log** from §1 **and** the session context:

- spot recurring patterns, new conventions, architectural decisions;
- scan `.claude/rules/` to avoid duplicates.

### 2.1 Rule frontmatter (`globs`)

When creating or updating `.claude/rules/**/*.md` YAML frontmatter:

- Write **`globs` values without surrounding double quotes**.
  - **Correct:** `globs: database/model/**/*.go` or `globs: controllers/**/*.go,router/**`
  - **Wrong:** `globs: "database/model/**/*.go"`

(See also `core-rules/rule-manager-agent.md` and the `optimize-rule-attachment` command.)

---

## 3. Deliverables

For each pattern:

- coding convention → create / update a rule under `.claude/rules/` with an accurate
  `globs:` line (always-on rules are `@`-imported by `CLAUDE.md` instead — see
  `core-rules/rule-manager-agent.md`)
- repeatable multi-step procedure → skill under `.claude/skills/`
- workflow → command under `.claude/commands/`

Respect **`.claude/` language policy** above for every file under `.claude/`.

---

## 4. Report and anchor

**4.1** **Report (chat):** what was created or changed + which scope was analyzed (`<ANCHOR>..HEAD` or bootstrap). Language: see **`.claude/` language policy** (French allowed for chat only).

**4.2** If the run completes (analysis + updates done), **refresh the anchor** for the next run — still using **§0** (correct `working_directory` or `git -C`):

```bash
git rev-parse HEAD > .claude/gitanchor
```

Run this from **repository root** so `.claude/gitanchor` is written in the right place.
