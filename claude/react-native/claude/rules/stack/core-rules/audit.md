---
description: make audit — stack audit (shared rules, from ai-rules-stack) then the app's project audit (its own rules); keep checks and rules in step, audit-ignore syntax.
paths:
  - ".claude/rules/**"
  - "scripts/audit/**"
  - "tmp/audit/**"
---

# Rules audit (`make audit`)

Two audits, run one after the other by the app's `make audit` (the second runs even when the first fails;
the target exits 1 while an error remains). Each prints, as they run, the checks that are not OK — `❌ ERREUR`,
`🟠 À VÉRIFIER`, `🔵 SUGGESTION`, `⏭️ NON LANCÉ`, with what is expected, why, where, how to fix and how to
ignore — and writes its complete report. The output is in French; code and comments stay English.

| Audit | Checks | Code | Report |
|---|---|---|---|
| Stack | the stack rules (`.claude/rules/stack/`) + the contract with the Go back (`F-API-*`) | `sub-modules/ai-rules-stack/audit/react-native/` | `tmp/audit/<run>/stack/report.md` |
| Project | the app's own rules (`.claude/rules/project/`), only when the app has scriptable ones | `scripts/audit/` in the app, reusing the stack engine (`lib/engine.mjs`) | `tmp/audit/<run>/project/report.md` |

```make
audit:
	@status=0; export AUDIT_RUN=$$(date +%Y-%m-%d_%H-%M-%S); \
	node sub-modules/ai-rules-stack/audit/react-native/audit.mjs $(ARGS) || status=1; \
	printf '\n%s\n\n' '============================================================'; \
	node scripts/audit/audit.mjs $(ARGS) || status=1; \
	exit $$status
```

Options, passed through `ARGS` (make keeps `-h` for itself): `make audit ARGS=-v` / `--verbose` prints every
check, OK ones too; `make audit ARGS=-h` / `--help` prints what each audit does and its checks, one line each,
without running them. The project audit takes the same options (`parseArgs`, `printHelp` from the engine).

Reports are generated, never versioned: `tmp/` is git-ignored. Each run gets its own folder,
`tmp/audit/<run>/` with `<run>` its date and time (`AAAA-MM-JJ_HH-MM-SS`), holding `stack/` and `project/`: earlier
runs stay as a trace of what was fixed — never delete them unasked. The latest run is the last folder by name.
`make audit` sets `AUDIT_RUN` once so both audits of a run share the folder; run alone, an audit names it itself.

Settings, all optional (environment): `AUDIT_BACK_DIR` (default `../<app>-back`), `AUDIT_RUN` (the run folder's
name). The app's DS is not compared with the stack's: apps drift on purpose, their DS evolutions go up to the
stack through `/promote-ds`.

## Running it

- `/audit` runs it, lists what to fix and asks the user which points to handle before changing anything.
- Never run it on your own, never wire it into a hook, a pre-commit or CI.

## Keeping checks and rules in step

- Changing a stack rule that a script can verify → update its check in ai-rules-stack
  (`audit/react-native/checks/`, wording in `checks/texts.mjs`) in the same change. Changing a project rule →
  same in the app's `scripts/audit/` (`checks.mjs`, `texts.mjs`).
- A rule no check covers shows up under "Règles sans vérification automatique" in the report of its audit.
- Wording — `title` (the subject), `expected` (the rule in plain words), `why`, `fix` — is plain French for
  someone who has not read the rule; a finding message says what is wrong at that place, not just a name.
- References are stable — `F-<AREA>-NN` for the stack, `P-<AREA>-NN` for the project: `audit-ignore` comments
  use them. Never renumber; retire an id.
- A check stays precise: a false positive is fixed in the check (narrow it, resolve through the type
  checker), not silenced file by file.

## Ignoring a finding

A legitimate exception is silenced where it lives, with its reason: `// audit-ignore F-XXX-00: reason`
(`{/* audit-ignore F-XXX-00: reason */}` in JSX) on the line or the line above — anywhere in the file for a
finding without a line. `*-TOOL-*` checks (tsc, Biome) cannot be silenced.
