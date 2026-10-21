---
name: checkup
description: >-
  Release checkup: sync-doc, make audit (ask before fixes), expo install
  --check + expo-doctor (ask), npm run check (ask), tests (ask), then biome
  --write. Use for /checkup.
---

# `/checkup` — docs, audit, deps, check, tests, format

Run the steps **in order**. Each gate that can change code **asks and waits**
before editing — same contract as `/audit`. Talk to the user in French for
reports and questions. Never commit or push.

## Arguments

- **(none)** — full checkup on this app; `make audit` also hits the Go back when present.
- **`local`** — pass `local` to the audit step (skip the sibling backend).

## 0. Preconditions

- Work from the **app repository root** (not the submodule).
- If `docs/functional/` is missing, say so for step 1 and **continue** with the rest (creating the first docs is a separate job).
- Do not edit `sub-modules/`.

## 1. Sync functional docs (`/sync-doc`)

Follow **exactly** the `/sync-doc` command (same steps, same Never list): bring
`docs/functional/` up to date with commits since `.last-sync`, fix rule headers,
report, settle doubts, move the anchor only when doubts are settled.

If sync-doc must **stop** (no docs folder, bad anchor, rewritten history), report
why and continue to step 2 unless the user asks to abort the whole `/checkup`.

## 2. Audit (`make audit`)

Follow **exactly** the `/audit` command with the same argument as this run
(`local` or none): run `make audit`, list findings, **AskQuestion**
(`allow_multiple: true`) for what to fix, fix only what was picked, re-run
audit, report before → after.

Do **not** start step 3 until the audit ask/fix/re-run cycle for this step is done
(or the user picked nothing / skipped).

## 3. Expo dependency alignment

1. Run `npx expo install --check` at the app root.
2. If the output reports **nothing to change**, say so and go to step 4.
3. Otherwise: short report (packages out of range / suggested versions). Ask with
   **AskQuestion** whether to apply the suggested fixes (typically
   `npx expo install --fix`, or the exact packages Expo prints). **Do not
   change `package.json` / lockfile before the answer.**
4. If the user declines or there is nothing to do, continue.

## 4. Expo doctor

1. Run `npx expo-doctor` at the app root.
2. If everything is OK, say so and go to step 5.
3. Otherwise: short report of the findings. Ask with **AskQuestion** which
   issues to handle now. Fix only what was picked (deps, config, peer ranges,
   etc.). Re-run `npx expo-doctor` and show before → after.
4. If the user picks nothing, continue with remaining findings noted in the final report.

## 5. `npm run check` (Biome CI + TypeScript)

1. Run `npm run check` (`biome ci . && tsc --noEmit`).
2. If exit 0: say so and go to step 6.
3. Otherwise: split the failures (Biome vs `tsc`), list them (file, line, message),
   propose a short fix plan, ask with **AskQuestion** which to fix now. Fix only
   what was picked. Re-run `npm run check` and show before → after.
4. If the user picks nothing, continue with remaining errors noted in the final report.

## 6. Tests

1. Detect how to run tests, in this order:
   - `npm test` / `npm run test` if defined in `package.json`
   - otherwise `npx jest` / `npx vitest run` only if that runner is clearly a
     project dependency
2. If **no test script and no test runner** are set up: say so (e.g. “no test
   suite”) and **skip** — do not invent a test harness.
3. If tests exist: run them. On failure, summarize failing suites/cases, ask with
   **AskQuestion** which failures to fix now. Fix only what was picked; re-run
   tests; show before → after.
4. If the user picks nothing, continue with remaining failures noted in the final report.

## 7. Biome write

Run `npm run fix` (`biome check --write .`) at the app root.

- Last mutating step so it formats audit / check / test fixes too.
- Do **not** ask before running unless it fails; if it fails, show the errors and
  ask whether to fix them.
- Never format under `sub-modules/`.

## 8. Final report

One short summary:

- sync-doc: done / skipped / stopped (why); doubts left if any
- audit: counts still not OK; what was fixed vs left aside
- expo install --check: aligned / skipped / declined
- expo-doctor: clean / remaining / declined
- npm run check: clean / remaining errors
- tests: clean / skipped (no suite) / remaining failures
- biome write: ok / failed

Remind: nothing was committed — the user reviews the diff.
