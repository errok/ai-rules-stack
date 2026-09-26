---
description: Tune .claude/rules paths and content so each conversation loads as little context as possible
---

# Optimize rule attachment

Use this when refactoring `.claude/rules/`. How Claude Code loads rules:

- a rule **without** `paths:` frontmatter is loaded in every conversation (always-on);
- a rule **with** `paths:` is loaded when Claude reads a file matching one of its globs;
- `paths:` is the only frontmatter key Claude Code reads (`description` is for humans).

Goal: the always-on set stays minimal, each scoped rule has tight, accurate `paths:`, and no
guidance is stated twice in files that load together. Work from the target repository root;
paths are repo-relative.

---

## What "good" looks like

1. **Always-on set is small** — only repo-wide maps (the files `STACK.md` `@`-imports).
   Everything else is scoped.
2. **`paths:`** — the smallest subtree where the rule matters, not a blanket `**/*` unless
   truly universal. A YAML list of quoted globs:

   ```yaml
   paths:
     - "services/**/*.go"
     - "router/router.go"
   ```

3. **No duplication** — each piece of guidance lives in one file: the one whose `paths:` best
   match where it applies. Files that load together (always-on + anything, or scoped rules with
   overlapping `paths:`) must not restate each other.
4. **Portable body** — placeholder names in examples, concepts over one-off filenames, other
   rules cross-referenced by title and category, so the rule forks into another project with
   minimal search-replace.

---

## Workflow

1. List `.claude/rules/**/*.md`; read each frontmatter and note which files have no `paths:`.
2. Flag broad `paths:`, `paths:` that match nothing in the repo, and always-on content that only
   concerns a narrow set of files.
3. Find guidance repeated across files that load together; keep one copy.
4. Tighten `paths:`, move narrow always-on content into scoped rules, make bodies portable.

---

## Deliverable

- Concrete edits to rule frontmatter and bodies.
- Short summary: `paths:` changed, content moved or merged, lines saved at session start.
