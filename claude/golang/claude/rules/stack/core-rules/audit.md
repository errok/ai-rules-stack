---
description: make audit — stack audit of the Go backend (ai-rules-stack, own Go module), plus a project audit only when the backend has scriptable rules of its own; keep checks and rules in step, audit-ignore syntax.
paths:
  - ".claude/rules/**"
  - "scripts/audit/**"
  - "tmp/audit/**"
---

# Rules audit (`make audit`)

The stack audit lives in `sub-modules/ai-rules-stack/audit/golang/` (Go, `go/ast`, stdlib only, its own
`go.mod` so the backend's `go build ./...` never compiles it). It checks the stack rules
(`.claude/rules/stack/`), prints as they run the checks that are not OK — `❌ ERREUR`, `🟠 À VÉRIFIER`,
`🔵 SUGGESTION`, with what is expected, why, where, how to fix and how to ignore — and writes the complete
`tmp/audit/<run>/stack/report.md`, `<run>` being the date and time of the run (`AAAA-MM-JJ_HH-MM-SS`, or
`AUDIT_RUN` when set). The output is in French; code and comments stay English.

```make
audit:
	@cd sub-modules/ai-rules-stack/audit/golang && go run . -root $(CURDIR) $(ARGS)
```

Options: `-root` (backend root, default the working directory), `-out` (report path relative to the root,
instead of the run folder),
`-v` / `--verbose` (every check, OK ones too), `-h` / `--help` (what the audit does and its checks, one line
each, without running them). From make: `make audit ARGS=-v`, `make audit ARGS=--help`.
The report is generated, never versioned: `tmp/` is git-ignored (air already builds there). Each run keeps its
own folder as a trace of what was fixed — never delete them unasked; the latest run is the last folder by name.
The front ↔ back contract (DTOs, requests, routes) is checked from the app (`make audit` there).

When the backend gets project rules a script can verify, add a project audit in its `scripts/audit/` and run it
after the stack one from `make audit` (the second runs even when the first fails; exit 1 while an error remains).

## Running it

- `/audit` runs it, lists what to fix and asks the user which points to handle before changing anything.
- Never run it on your own, never wire it into a hook, a pre-commit or CI.

## Keeping checks and rules in step

- Changing a stack rule that a script can verify → update its check in ai-rules-stack
  (`audit/golang/checks_*.go`, wording in `texts.go`) in the same change.
- A rule no check covers shows up under "Règles sans vérification automatique" in the report.
- Wording — `title` (the subject), `expected` (the rule in plain words), `why`, `fix` — is plain French for
  someone who has not read the rule; a finding message says what is wrong at that place, not just a name.
- References (`B-<AREA>-NN`) are stable: `audit-ignore` comments use them. Never renumber; retire an id.
- A check stays precise: a false positive is fixed in the check, not silenced file by file.

## Ignoring a finding

A legitimate exception is silenced where it lives, with its reason: `// audit-ignore B-XXX-00: reason` on the
line or the line above (`#` in a `.env`; anywhere in the file for a finding without a line). `*-TOOL-*`
checks (gofmt, build, vet) cannot be silenced.
