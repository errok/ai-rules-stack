# Audit — the stack rules, checked by a script

Tooling behind each app's `make audit` and the `/audit` command. Apps run it from the submodule
(`sub-modules/ai-rules-stack/audit/…`); the rules that describe it for the agent are `core-rules/audit.md`
(both stacks), `service-rules/api-contract.md` (react-native) and `api-rules/front-contract.md` (golang).

| Folder | What | Entry points (run from the app root) |
|---|---|---|
| `react-native/` | Node + TypeScript compiler (the app's `typescript`) | `audit.mjs` (stack audit), `api-map.mjs`, `dto-check.mjs` |
| `golang/` | Go, `go/ast`, stdlib only, own `go.mod` | `go run . -root <backend>` from `audit/golang` |

- **Stack audit** = the stack rules only. An app's own rules get a **project audit** in the app
  (`scripts/audit/`), built on `react-native/lib/engine.mjs` (`runAudit`, `createProject`, helpers), run right
  after the stack one by the app's `make audit`.
- A check = logic in `checks/` (react-native) or `checks_*.go` (golang), wording in `checks/texts.mjs` /
  `texts.go`. Every check points at the rule file it enforces; change both in the same commit.
- References are stable (`F-*` react-native, `B-*` golang, `P-*` project): apps' `audit-ignore` comments use
  them. Never renumber; retire an id.
- Nothing is app-specific here: the app name comes from its folder, the back from `../<app>-back` or
  `AUDIT_BACK_DIR`, the stack branch compared for the DS from `AUDIT_STACK_REF` (default `origin_stack/main`).
