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
- **Domain rules** live under `.claude/rules/stack/**` with a `globs:` line in their
  frontmatter. The `PreToolUse` hook `.claude/hooks/inject-rules.mjs` (wired in
  `.claude/settings.json`) reads that `globs:` and, right before any
  `Edit`/`Write`, injects every rule whose glob matches the target file — once
  per session, re-injected after a context compaction (`PreCompact` clears the
  cache). No manual step needed; the table below is reference + fallback if hooks
  are disabled. The user can also `@`-mention a rule directly.
- To add/change a rule, follow `.claude/rules/stack/core-rules/rule-manager-agent.md`:
  the `globs:` line is what drives injection — keep it accurate — and keep the
  table below in sync (`/optimize-rule-attachment` rebuilds it).
- Flat layout at repo root — **no `app/` wrapper folder** in any path or glob.

## Always-on rules

@.claude/rules/stack/core-rules/project-architecture-always.md
@.claude/rules/stack/core-rules/no-go-test-auto.md

## Domain rules (read before editing matching paths)

| Paths | Rule |
|---|---|
| `controllers/**/*.go`, `router/**/*.go` | `.claude/rules/stack/api-rules/api-auto.md` — controller layout (`*_dto.go` / `*_request.go` / `*_mapper.go` / `<res>.go`), data-only DTOs, mapper aliases, `GetList`/`GetOne`, routes, HTTP codes |
| `controllers/**/*.go`, `router/**/*.go` | `.claude/rules/stack/api-rules/controller-initialization-order.md` — controllers are structs built once in `InitializeRouter` (composition root, after DB connect) and injected; no package-level `var … = New()`, no per-request construction; fields application → services → clients |
| `config/**/*.go` | `.claude/rules/stack/config-rules/configuration-auto.md` — Viper env loading, typed sub-configs, no hardcoded secrets, keep `.example.env` in sync |
| `application/**/*.go`, `controllers/**/*.go` | `.claude/rules/stack/core-rules/application-layer.md` — transport-agnostic orchestration; a handler needing 2+ level-1 services must call an `application/<object>` orchestrator, not wire them inline |
| `database/db.go`, `database/model/**/*.go` | `.claude/rules/stack/database-rules/database-auto.md` — GORM table mirrors, schema subfolders, `GetDB()`, transactions, `init.sql` bootstrap |
| `database/**`, `database/model/**/*.go`, `database/tables/**/*.sql`, `database/init.sql` | `.claude/rules/stack/database-rules/table-naming.md` — `*_type` / `*_instance` / composition / M-N / status taxonomy |
| `database/model/**/*.go` | `.claude/rules/stack/database-rules/gorm-model-associations.md` — each `XxxID` has a matching association for Preload/Joins |
| `controllers/**/*.go`, `services/**/*.go`, `application/**/*.go`, `middleware/**/*.go`, `infrastructure/**/*.go` | `.claude/rules/stack/logging-rules/logging-auto.md` — `CTRLogger` / `SRCLogger` / scoped loggers from `commons/helpers`; never `logrus` or stdlib `log`; no secrets |
| `middleware/**/*.go`, `infrastructure/**/*.go`, `services/**/authctx.go`, `services/**/client.go` | `.claude/rules/stack/security-rules/security-auto.md` — bearer JWT in middleware, `AuthCheck` / `EnsureUserExists`, `http.Server` timeouts, ownership scoping, input validation, no stack traces in 500s |
| `services/**/client.go`, `services/**/authctx.go`, `services/**/http_client.go` | `.claude/rules/stack/service-rules/external-api-clients.md` — external HTTP client layer: `sync.Once` `DefaultClient()`, bounded `Timeout`, `*WithContext`, `AttachBearer`, DEBUG-only body logs |
| `services/*/*/**/*.go` | `.claude/rules/stack/service-rules/pure-subpackages.md` — stateless pure functions under `services/<domain>/<name>/`; no GORM, no HTTP, no cross level-1 imports |
| `services/**/*.go` | `.claude/rules/stack/service-rules/services-auto.md` — level-1 services never call each other, `*_domain.go` / `*_mapper.go` / `<name>.go`, data-only domain types, load full domain, `GetList`/`GetOne` |

On request only: `.claude/rules/stack/core-rules/rule-manager-agent.md` — how to create/update/delete rules, skills, and commands.

## Commands (`/name`)

- `/commit` — split the working tree into focused Conventional Commits (English)
- `/learn` — infer rules/skills/commands from the git delta since `.claude/gitanchor` + this conversation
- `/optimize-rule-attachment` — tune rule globs/descriptions and rebuild the table above
