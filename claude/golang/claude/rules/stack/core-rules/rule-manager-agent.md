---
description: Apply when the user asks to create, update or delete a Claude rule, skill, or command. Also apply when the user says "remember this", "always do X", "never do Y", or when a recurring pattern should be codified into .claude/.
globs:
---

# Rule Manager

## File locations

| Type | Location | Notes |
|---|---|---|
| Always-on rule | `.claude/rules/stack/core-rules/` (stack) · `.claude/rules/project/` (project) | `@`-imported from `STACK.md` (stack) or `CLAUDE.md` (project) so it is always in context; empty `globs:` line |
| Scoped rule | `.claude/rules/stack/{category}/` (stack) · `.claude/rules/project/` (project) | Injected by the hook before an `Edit`/`Write` to a file matching its `globs:` (see **Attachment model**) |
| Skill | `.claude/skills/{name}/SKILL.md` | Model-invoked from its own `description` |
| Command | `.claude/commands/{name}.md` | Slash command (`/{name}`) |

Existing files keep their historical `*-auto` / `*-always` / `*-agent` suffixes.
New rule files do **not** need a suffix.

## Categories
- `core-rules/` — architecture, global contracts, agent behavior
- `api-rules/` — controllers, DTOs, requests, router
- `service-rules/` — services, domain models, GORM queries
- `database-rules/` — DB models, migrations, connection
- `logging-rules/` — logging patterns and obligations
- `security-rules/` — auth, middleware, validation
- `config-rules/` — env variables, configuration

## Rules
- Before creating a rule, check if an existing rule already covers the pattern
- After changing architecture (router path, API version, DB model folder), **verify paths against the repo** — stale paths break agent guidance
- Keep each `.md` file under ~250 lines — split if needed
- Never add content to `project-architecture-always` unless it's truly global
- After any creation or update: `✅ .claude/rules/{path}/{file}.md created/updated`
- All authored content under `.claude/` must be **English** (chat summaries to the user may use French if the team prefers)

## Attachment model (Claude Code)
- **`globs:` frontmatter** — unquoted, comma-separated line (`globs: database/model/**/*.go`). The `PreToolUse` hook `.claude/hooks/inject-rules.mjs` reads it and injects the rule before an `Edit`/`Write` to a matching file (once per session; re-injected after a context compaction). It is the only rule index — `CLAUDE.md` does not list scoped rules.
- **`globs:` is load-bearing** — an inaccurate or missing glob means the rule never fires. After changing folders/paths, re-check every `globs:`.
- **Always-on rules** (e.g. `project-architecture-always.md`, `no-go-test-auto.md`) are `@`-imported by `STACK.md` (project ones by `CLAUDE.md`); leave their `globs:` line empty so the hook does not double-inject them.
- **Tight globs** — the smallest path that needs the rule (`application/**/*.go`, `services/**/client.go`), not `**/*.go` unless truly universal.
- **Keyword-rich `description`** — folders (`controllers/v1`, `middleware`), symbols (`CTRLogger`, `GORM`, `Supabase`), short intent phrases, so the rule surfaces on retrieval / `@`-mention when the open file does not obviously match.
- **Always-on** — only repo-wide maps (e.g. `project-architecture-always.md`), `@`-imported in `STACK.md` (project ones in `CLAUDE.md`). Do not widen other rules to compensate.
- **Overlap** between globs is acceptable when it keeps a rule discoverable; avoid duplicating the same guidance across two files.
- **No `app/` prefix** — this stack uses a flat layout at repo root; globs and paths must not reference an `app/` wrapper folder.
