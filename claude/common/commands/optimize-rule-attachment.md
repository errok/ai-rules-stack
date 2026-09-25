---
description: Tune .claude/rules globs and descriptions so scoped context stays small and rules stay reusable
---

# Optimize rule attachment (globs + descriptions)

Use this when refactoring `.claude/rules/`. Attachment works like this:

- always-on rules are `@`-imported by `CLAUDE.md` (their `globs:` line is empty);
- every scoped rule carries a `globs:` line; the `PreToolUse` hook
  `.claude/hooks/inject-rules.mjs` injects it before an `Edit`/`Write` to a
  matching file (once per session). `globs:` is the only index: `CLAUDE.md` and
  `STACK.md` do not list scoped rules.

Goal: the always-on set stays minimal, each scoped rule has a tight, accurate
`globs:` and a keyword-rich `description`.

Work from the **target repository root**. This stack uses a **flat layout at repo
root** (`controllers/`, `services/`, `router/`, `database/model/`, …) — globs and
paths must **not** reference an `app/` wrapper folder.

---

## What "good" looks like

1. **Always-on set is small** — only `project-architecture-always.md`. Everything
   else is scoped.
2. **`globs`** — smallest subtree where the rule matters
   (`application/**/*.go`, `services/**/client.go`, `database/model/**/*.go`), not
   blanket `**/*.go` unless truly universal. Some overlap is fine when it keeps a
   rule discoverable.
3. **`description`, body, examples, cross-references** — as generic as possible so
   the rule forks into another project with minimal search-replace.
   - No one-off filenames or business-only paths in prose.
   - Prefer concepts/roles: “level-1 service”, “application orchestrator”,
     “external API client”, “auth middleware”.
   - Placeholder names in examples (`UserDto`, `srvUser`, `order/pricing`).
   - Cross-reference other rules by **title / category** (“the **Services —
     business logic** rule under `service-rules/`”), not by filename.
4. **`globs` YAML** — one unquoted, comma-separated line.
   - Correct: `globs: controllers/**/*.go,router/**` 
   - Wrong: `globs: "controllers/**/*.go"` or a quoted YAML list.

---

## Workflow

1. From the repo root, list `.claude/rules/**/*.md`; read each frontmatter
   (`description`, `globs`) and note which files `CLAUDE.md` `@`-imports.
2. Flag overly broad globs, empty `description`s, and `@`-imports in `CLAUDE.md`
   that point at a missing/renamed file.
3. For each rule:
   - Tighten `globs` to the smallest subtree that still covers enforcement.
   - Rewrite `description` / body toward portable language; drop project-only file
     references and `.md` cross-links in favour of rule titles + categories.
4. Confirm the `@`-import list in `CLAUDE.md` / `STACK.md` is exactly the
   always-on set.

---

## Deliverable

- Concrete edits to rule frontmatter/body.
- Short summary: which globs changed, which rules were merged/split, what was
  generalised.
