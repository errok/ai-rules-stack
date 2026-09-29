---
description: Run the release audit (stack rules + contract with the Go back, then the app's own rules), list what to fix and ask the user which points to handle — never change code before that answer.
disable-model-invocation: true
argument-hint: "[local] — skip the backend audit"
---

# /audit — release audit, then fixes the user picks

## 1. Run

- Run `make audit` at the root of this repo. It runs the **stack audit** then, when the app has one, the
  **project audit**, one after the other. Each prints, check by check as they run, a status — `✅ OK`,
  `❌ ERREUR`, `🟠 À VÉRIFIER`, `🔵 SUGGESTION`, `⏭️ NON LANCÉ` — with what to do and every place involved, and
  writes `docs/reports/audit-stack.md` / `docs/reports/audit-project.md`. **Exit code 1 means errors remain**
  — that is the result, not a failure of the command.
- Unless the argument is `local`, when the Go back sits next to the app (`../<app>-back`, or `AUDIT_BACK_DIR`)
  also run `make audit` there (`documentation/reports/audit-stack.md`), so the release is checked on both sides.
- Show the user the status lines as printed (every audit), then the totals. Talk to the user in French, with
  the same status words; the reference in brackets (`[F-SVC-01]`, `[P-TW-01]`) is how the user and the reports
  name a point.

## 2. Read and list

Read each report. For every check that is not OK, from its section: the rule (open the rule file when the fix
is not obvious), the **Comment corriger** line and every place listed. Then give the user **one list of the points to
fix**, grouped by check and ordered ❌ ERREUR → 🟠 À VÉRIFIER → 🔵 SUGGESTION:

`<status> <title> [<reference>] — <n> endroit(s) — <the fix, in one line> — <effort: mécanique | à juger | suppression>`

Then say which you propose to handle now and why:

- **Proposed:** every ❌ ERREUR, and the 🟠 whose fix is mechanical and local (rename, missing banner, class swap).
- **Not proposed without an explicit yes:** anything that removes code or fields (🔵 SUGGESTION dead code,
  unused DTO fields, commented-out code — see the no-unrequested-cleanup rule), a change on the other repo, and
  🟠 that may be legitimate (then offer an `audit-ignore <reference>: <reason>` instead of a fix).
- **Not fixable here:** `components/ds/**` findings — they go to the stack through `/promote-ds`.

## 3. Ask — and wait

Ask with **AskUserQuestion** (multiSelect) which points to handle: one option per check or per batch of
related checks, the proposed ones first and marked "(Recommended)". The user can answer with references
through "Other". **Do not edit any file before the answer.** If the user picks nothing, stop there.

## 4. Fix what was picked, nothing else

- Follow the rule and the report's **Comment corriger** line for each picked check; keep the surrounding code style.
- A finding that turns out legitimate while fixing: stop on it, tell the user, and propose an `audit-ignore`
  comment with the reason instead of forcing a fix.
- Never edit a report by hand; never commit.

## 5. Re-run and report

Run `make audit` again (in each repo touched) and show the status lines of the handled checks before → after,
plus anything that got worse. List what is still not OK and was left aside.
