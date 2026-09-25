---
description: Apply when the user asks to create, update or delete a Claude rule, skill, or command. Also apply when the user says "remember this", "always do X", "never do Y", or when a recurring pattern is identified that should be codified into .claude/.
globs:
---

# Rule Manager

/ Ported from Cursor. In Claude Code there is **no automatic glob-based rule
attachment**: `.claude/rules/**` files are a library, and `CLAUDE.md` is what
wires them in. Keep both in sync. /

## File locations

| Type | Location | Notes |
|---|---|---|
| Always-on rule | `.claude/rules/core-rules/` | Referenced from root `CLAUDE.md` with `@.claude/rules/core-rules/{file}.md` so it is always in context |
| Scoped rule | `.claude/rules/{category}/` | Listed in the **Domain rules** table of `CLAUDE.md` with its `globs`; the agent reads it before editing files that match |
| Skill | `.claude/skills/{name}/SKILL.md` | Model-invoked from its own `description` |
| Command | `.claude/commands/{name}.md` | Slash command (`/{name}`) |

Existing files keep their historical `*-auto` / `*-always` / `*-agent` suffixes
(from the Cursor port). New rule files do **not** need a suffix — name them
`{topic}.md`.

## Categories
- `core-rules/` — agent behavior, architecture, global contracts
- `ts-rules/` — TypeScript, typing conventions
- `component-rules/` — components and screens structure
- `service-rules/` — HTTP services layer
- `store-rules/` — Zustand stores and MMKV
- `stack-rules/` — React Navigation and other stack libraries
- `ui-rules/` — design tokens, Tailwind, SVG, markdown, pictos
- `auth-rules/` — Supabase auth provider

## Rules
- Before creating a rule, check if an existing rule already covers the pattern
- Keep rules concise — no redundancy between rule files
- Always use English in rule content
- After any creation or update, confirm: `✅ .claude/rules/{path}/{file}.md created/updated`

## Rule size guardrails
- Keep each `.md` file under ~250 lines when possible
- If a rule grows too large or mixes concerns, propose splitting it into focused rules
- Prefer a new rule file over piling more into an always-on `core-rules/` file

## Attachment model (Claude Code)
- **Always-on:** only true repo-wide maps (architecture, naming, no-unrequested-cleanup). Add them to `CLAUDE.md` via `@`-import, and leave their `globs:` line empty so the hook does not double-inject them.
- **Scoped:** everything else. Give the rule a keyword-rich `description` (topics, folder names, symbols like `DsIcon`, `DsModal`) and a tight `globs:` line (smallest subtree that needs it, unquoted, comma-separated). The `PreToolUse` hook `.claude/hooks/inject-rules.mjs` reads `globs:` and injects the rule before an `Edit`/`Write` to a matching file (once per session). `globs:` is the only rule index — `CLAUDE.md` does not list scoped rules. The user can `@`-mention it explicitly.
- **`globs:` is load-bearing** — an inaccurate or missing glob means the rule never fires. After renaming/moving folders, re-check every `globs:`.
- **Overlap** between globs is fine when it keeps a rule discoverable; avoid duplicating the *same* guidance across two files.
- **This repo has no `src/`** — use root folders (`screens/`, `components/`, `navigation/`, …).
