---
name: learn
description: Analyzes recent changes and conversation to create or update .continue/ rules and prompts based on identified patterns
invokable: true
---

# `/learn` — single workflow

**Goal:** infer **rules / prompts** from the **Git delta since the last `/learn`** plus the **current conversation**, without processing the same commits twice.

**`.continue/gitanchor`** holds **one line**: the SHA of the last commit already covered. Everything **after** that SHA (`<ANCHOR>..HEAD`) is this run’s Git scope.

---

## `.continue/` language policy (canonical)

- All **authored** content under `.continue/` (rules, prompts, and any docs in that tree) must be **English**.
- **Exception:** the **chat summary** you post after this workflow may be **French** (team preference). Any **files** you create or edit under `.continue/` during `/learn` stay **English**.

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

**1.1** Read `.continue/gitanchor` (trim; ignore empty lines and `#` comments). If missing, empty, or not a plausible Git SHA → **bootstrap** (go to **1.4**).

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
- scan `.continue/rules/` to avoid duplicates.

### 2.1 Rule frontmatter (`globs`)

When creating or updating `.continue/rules/**/*.md` YAML frontmatter:

- Prefer a YAML list of quoted globs (Continue format):
  - **Correct:**
    ```yaml
    globs:
      - "services/**"
      - "stores/**"
    ```
  - Or a single string: `globs: "services/**"`
- Set `alwaysApply: true` only for true repo-wide maps; otherwise `alwaysApply: false` with `globs` and a keyword-rich `description`.
- Always include `name:` (display title).

(See also `core-rules/rule-manager-agent.md` and the `optimize-rule-attachment` prompt.)

---

## 3. Deliverables

For each pattern:

- coding convention → create / update a rule under `.continue/rules/`
- slash-command workflow → prompt under `.continue/prompts/` with `invokable: true`

Respect **`.continue/` language policy** above for every file under `.continue/`.

---

## 4. Report and anchor

**4.1** **Report (chat):** what was created or changed + which scope was analyzed (`<ANCHOR>..HEAD` or bootstrap). Language: see **`.continue/` language policy** (French allowed for chat only).

**4.2** If the run completes (analysis + updates done), **refresh the anchor** for the next run — still using **§0** (correct `working_directory` or `git -C`):

```bash
git rev-parse HEAD > .continue/gitanchor
```

Run this from **repository root** so `.continue/gitanchor` is written in the right place.
