---
description: Split the working tree into focused Conventional Commits (English), safely
---

# Commit current changes

Commit the current uncommitted work in this repository.

## Goals

1. Inspect the working tree and decide how to split commits.
2. Create one or more git commits with **English** Conventional Commit messages.
3. Prefer **several focused commits** over one large dump — but **do not** create one commit per file.

## Safety

- Only create commits when running this command (explicit user intent).
- Never update git config.
- Never use `--no-verify`, `--no-gpg-sign`, or similar hook bypasses unless the user explicitly asks.
- Never amend unless the user explicitly asks and the usual amend safety conditions are met.
- Never push unless the user explicitly asks.
- Do not commit secrets (`.env`, credentials, tokens, etc.). Warn and skip those files.
- Never use interactive git flags (`-i`).
- **Never** add an agent co-author trailer (`Co-authored-by: Cursor`, `Co-authored-by: Claude`, `Co-Authored-By: Claude …`, etc.) — no `--trailer Co-authored-by:…` for any assistant unless the user explicitly asks.

## Workflow

Run in parallel first:

```bash
git status
git diff
git diff --cached
git log -8 --oneline
```

Then:

1. **Analyze** all unstaged / untracked / staged changes.
2. **Plan commits** by logical concern (see Split policy).
3. For each commit, in order:
   - Stage only the files (or hunks) that belong to that commit.
   - Draft the message (see Message format).
   - Commit with a HEREDOC:

```bash
git commit -m "$(cat <<'EOF'
type(scope): short summary

Optional body explaining why (not what).
EOF
)"
```

4. After all commits: `git status` and briefly list the commits created (hash + subject).

If there is nothing to commit, say so and stop.

If a commit fails due to a pre-commit hook:

- Fix the issue.
- Create a **new** commit (do not amend unless the user asked and amend rules allow it).

## Split policy

Split when changes are **independently reviewable** and fall into different concerns, for example:

| Split | Keep together |
|---|---|
| New feature vs unrelated refactor | Feature + its tokens / debug lab / barrel export |
| Bug fix vs new API | Same feature across component + tokens + types |
| Docs-only vs code | Pure formatting that landed with a feature (optional `style` commit only if large/noisy) |
| Dependency bump vs app logic | Tiny drive-by typo in the same touched file |

**Do not** over-split:

- Not one commit per file.
- Not separate commits for “add file” vs “wire import” of the same feature.
- Not a separate commit for every prop JSDoc line if it ships with the component work.

If everything is one coherent change, **one commit is fine**.

When splitting, commit in a dependency-friendly order (foundation/tokens before consumers, feature before docs if both exist).

## Message format

```
type(scope): short summary
```

- **Language:** English only (subject + body).
- **Subject:** imperative, concise, ~72 chars; no trailing period.
- **Scope:** optional but preferred when clear (`ds`, `auth`, `tokens`, `menu`, `nav`, …).
- **Body:** optional; focus on **why**, not a file list.
- Match the repository’s recent `git log` tone when possible.

### Types

Use exactly these types:

| Type | When |
|---|---|
| `feat` | New user-facing capability or DS/API surface |
| `fix` | Bug fix |
| `docs` | Documentation only (README, guides, comments-only docs commits) |
| `style` | Formatting / whitespace only — no logic change |
| `refactor` | Internal restructuring with no intended behavior change |
| `test` | Add or update tests |
| `chore` | Tooling, deps, config, housekeeping with no direct product behavior |

### Examples (English)

```
feat(ui): add dark mode support
fix(api): correct JSON response shape
docs: update install instructions
style(css): remove unused margins
refactor(api): simplify validation branches
test(auth): add unit tests for login
chore(deps): bump lodash to 4.17.21
```

Repo-flavored examples:

```
feat(ds): add DsCard with shared box-shadow tokens
docs(ds): document design-system component props
refactor(tokens): split component colors into light/dark modules
fix(onboarding): fix layout on iPhone SE
chore(version): 1.0.3
```

## Output

When done, report:

- How many commits were created
- Each `hash` + subject
- Anything left uncommitted (and why)
