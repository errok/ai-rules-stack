# Stack rules — React Native

**Generic layer, shared by every project built on this stack.** Consuming projects
`@`-import this file from their own `CLAUDE.md`, then declare what is specific to
them. It is reached through the symlink `.claude/rules/stack/`, so everything here
must hold for *any* app on the stack.

Independent from the Cursor rules (`.cursor/`): a Claude rule links only to other Claude
rules (`.md`), never to a Cursor file (`.mdc`) — and the Cursor rules never link here.

## Generic vs project

| Goes here (`rules/stack/`) | Goes in the project (`rules/project/`) |
|---|---|
| Naming, token layers, folder structure, HTTP/store/navigation contracts | Palette **values**, theme decisions, product exceptions, domain vocabulary |

Rule of thumb: if the sentence names a color, a feature, or a screen, it belongs
to the project, not here.

## How rules attach

- **Always-on rules** are `@`-imported just below — always in context.
- **Domain rules** live under `.claude/rules/**` with a `globs:` line in their
  frontmatter; the rule-injection hook adds each one before an `Edit`/`Write` to a
  matching file. No index to maintain: the `globs:` line is the only mapping.
- To add/change a rule, follow `.claude/rules/stack/core-rules/rule-manager-agent.md`.

## Always-on rules

@.claude/rules/stack/core-rules/project-architecture-always.md
@.claude/rules/stack/core-rules/naming-auto.md
@.claude/rules/stack/core-rules/no-unrequested-cleanup-always.md

On request only: `.claude/rules/stack/core-rules/rule-manager-agent.md` — how to create/update/delete rules, skills, and commands.

## Commands (`/name`)

- `/commit` — split the working tree into focused Conventional Commits (English)
- `/review` — review the current diff against these rules (French deliverable)
- `/learn` — infer rules/skills/commands from the git delta since `.claude/gitanchor` + this conversation
- `/optimize-rule-attachment` — tune rule globs and descriptions
- `/promote-ds` — neutralize `Ds*` APIs from a product branch onto stack `main`, then rebase
- `/fixsvg` — make icon SVGs tintable via the RN `color` prop
- `/comment-unused-type-keys` — comment out unused TypeScript type properties in given folders
- `/integrate-design` — set session context for building a screen/feature from a design reference (Claude Design artifact, HTML prototype, screenshot): visual reference only, reuse existing `ds`/`ds/composed` components, one component at a time with a plan before code
