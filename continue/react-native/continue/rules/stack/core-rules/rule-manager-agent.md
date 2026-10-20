---
name: Rule Manager
description: Apply when the user asks to create, update or delete a Continue rule or prompt. Also apply when the user says "remember this", "always do X", "never do Y", or when a recurring pattern is identified that should be codified into .continue/.
alwaysApply: false
---

# Rule Manager

## File locations

| Type | Location | Naming |
|---|---|---|
| Always rule | `.continue/rules/stack/core-rules/` (stack) · `.continue/rules/project/` (project) | `*-always.md` (historical) or plain `{topic}.md` |
| Auto-attached | `.continue/rules/stack/{category}/` (stack) · `.continue/rules/project/` (project) | `*-auto.md` (historical) or plain `{topic}.md` |
| Agent-requested | `.continue/rules/stack/{category}/` (stack) · `.continue/rules/project/` (project) | `*-agent.md` (historical) or plain `{topic}.md` with `alwaysApply: false` + `description` |
| Prompt (slash command) | `.continue/prompts/{name}.md` | `invokable: true` in frontmatter |

Existing files keep their historical `*-auto` / `*-always` / `*-agent` suffixes.
New rule files do **not** need a suffix. There is no `*-manual` type.

## Categories
- `core-rules/` — agent behavior, architecture, global contracts
- `ts-rules/` — TypeScript, typing conventions
- `component-rules/` — components and screens structure
- `ui-rules/` — tokens, Tailwind, SVG, markdown, spacing, loading-flag names
- `service-rules/` — HTTP services layer
- `store-rules/` — Zustand stores and MMKV
- `auth-rules/` — auth provider
- `stack-rules/` — navigation

## Rules
- Before creating a rule, check if an existing rule already covers the pattern
- Keep rules concise — no redundancy between rule files
- Always use English in rule content
- After any creation or update, confirm: `✅ .continue/rules/{path}/{file}.md created/updated`
- Stack rules come from the `ai-rules-stack` submodule: never edit them in a project — change them in `ai-rules-stack`, then bump the submodule

## Continue frontmatter
- Required: `name` (display title)
- Optional: `description`, `globs`, `alwaysApply`, `regex`
- Prefer YAML list of quoted globs:
  ```yaml
  globs:
    - "services/**"
    - "stores/**"
  ```
- `alwaysApply: true` — always included; use only for true repo-wide maps
- `alwaysApply: false` — included when globs match, or when the agent pulls the rule from `description`

## Rule size guardrails
- Keep each `.md` file under ~250 lines when possible
- If a rule grows too large or mixes concerns, proactively propose splitting it into multiple focused rules
- Prefer adding new rule files over extending an `alwaysApply: true` rule

## Globs vs descriptions (attachment)
- **Auto-attached:** rules with `globs` that match the active file load automatically. Overly broad globs (e.g. `**/*.tsx` for every TSX file) inflate context on every screen edit.
- **Prefer:** tight globs for **folder-specific** rules (`navigation/**`, `services/auth/**`, modal file paths). For **cross-cutting** conventions (icons, callbacks), scope globs to `components/**` when the same policy also holds for screens — rely on the **`description`** field so the agent can still pull the rule when editing `screens/**` or when the user @-mentions the topic.
- **Descriptions:** Write keyword-rich one-liners (topics, folder names, symbols like `DsIcon`, `DsModal`) so agent-requested retrieval stays useful when globs are narrow.
- **Screens:** Keep `component-screen-structure` (and similar) on `screens/**` where structure and navigation typing are screen-centric; avoid duplicating the same glob on every UI rule.
- **This repo has no `src/`** — use root folders (`screens/`, `components/`, `navigation/`, …).
