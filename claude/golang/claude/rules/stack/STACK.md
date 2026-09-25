# Stack rules — Go backend

**Generic layer, shared by every project built on this stack.** Consuming projects
`@`-import this file from their own `CLAUDE.md`, then declare what is specific to
them. It is reached through the symlink `.claude/rules/stack/`, so everything here
must hold for *any* service on the stack.

Ported from `.cursor/` (Cursor rules, symlinked). **Do not edit `.cursor/`** — it
is the upstream source; change rules here under `.claude/` instead.

## Generic vs project

| Goes here (`rules/stack/`) | Goes in the project (`rules/project/`) |
|---|---|
| Layering, naming, HTTP/DB/logging contracts, folder structure | Domain vocabulary, business invariants, product-specific exceptions |

Rule of thumb: if the sentence names a business entity, an endpoint or a feature,
it belongs to the project, not here.

## How rules attach

- **Always-on rules** are `@`-imported just below — always in context.
- **Domain rules** live under `.claude/rules/**` with a `globs:` line in their
  frontmatter; the rule-injection hook adds each one before an `Edit`/`Write` to a
  matching file. No index to maintain: the `globs:` line is the only mapping.
- To add/change a rule, follow `.claude/rules/stack/core-rules/rule-manager-agent.md`.
- Flat layout at repo root — **no `app/` wrapper folder** in any path or glob.

## Always-on rules

@.claude/rules/stack/core-rules/project-architecture-always.md
@.claude/rules/stack/core-rules/no-go-test-auto.md

On request only: `.claude/rules/stack/core-rules/rule-manager-agent.md` — how to create/update/delete rules, skills, and commands.

## Commands (`/name`)

- `/commit` — split the working tree into focused Conventional Commits (English)
- `/learn` — infer rules/skills/commands from the git delta since `.claude/gitanchor` + this conversation
- `/optimize-rule-attachment` — tune rule globs and descriptions
