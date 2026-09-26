---
description: Apply when the user asks to create, update or delete a Claude rule, skill, or command. Also apply when the user says "remember this", "always do X", "never do Y", or when a recurring pattern should be codified into .claude/.
paths:
  - ".claude/**"
  - "CLAUDE.md"
---

# Rule Manager

## Where things go

| Type | Location | Loaded |
|---|---|---|
| Always-on rule | `.claude/rules/stack/core-rules/` (stack) · `.claude/rules/project/` (project) | No `paths:` frontmatter → in every conversation. Stack ones are also `@`-imported by `STACK.md`, project ones by `CLAUDE.md` |
| Scoped rule | `.claude/rules/stack/{category}/` (stack) · `.claude/rules/project/` (project) | `paths:` frontmatter → when Claude reads a matching file |
| Skill | `.claude/skills/{name}/SKILL.md` | Its `description` only, until invoked |
| Command | `.claude/commands/{name}.md` | Its `description` only, until `/{name}` is run |

- Stack rules come from the `ai-rules-stack` submodule: never edit them in a project — change them in `ai-rules-stack`, then `make update-rules` (`make install-rules` after cloning, `make check-rules` to verify).
- `.claude/settings.json` is a copy of the stack template, not a link: keep it identical.
- Existing files keep their historical `*-auto` / `*-always` / `*-agent` suffixes; new files are named `{topic}.md`.

## Categories
- `core-rules/` — architecture, global contracts, agent behavior
- `api-rules/` — controllers, DTOs, requests, router
- `service-rules/` — services, domain models, GORM queries
- `database-rules/` — DB models, migrations, connection
- `logging-rules/` — logging patterns and obligations
- `security-rules/` — auth, middleware, validation
- `config-rules/` — env variables, configuration

## Writing rules
- Before creating a rule, check that no existing rule already covers the pattern. Never state the same guidance in two files that load together.
- Always-on only for true repo-wide maps; everything else is scoped. Never add to `project-architecture-always` unless it is truly global.
- `paths:` is the only frontmatter key Claude Code reads: a YAML list of quoted globs (`- "services/**/*.go"`). `description` is for humans. Keep `paths:` to the smallest subtree that needs the rule, and re-check every `paths:` after moving folders — a wrong path means the rule never loads.
- Claude rules link only to Claude rules (`.md`), never to Cursor files (`.mdc`).
- English only, concise, under ~250 lines per file — split a rule that mixes concerns.
- After any creation or update, confirm: `✅ .claude/rules/{path}/{file}.md created/updated`
