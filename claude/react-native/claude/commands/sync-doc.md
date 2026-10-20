---
description: Bring docs/functional up to date with the commits made since the last sync, and fix the rule headers of the touched files
---

# Sync the functional docs

Compare the code of **this repository** with its business rules in `docs/functional/`, from the last commit that was checked, and update the docs. A product usually has two repositories (this app and its API); run the command in each one. The sibling repository sits next to this one and is only read.

The docs are written **in the language of the existing docs**, from the code, never from the ticket tracker. They are the source of truth for the rules: a rule changes there and in the tests that cite its identifier. Do not touch the tests (that is a separate step).

## Layout the command relies on

- `docs/functional/<LANG>/README.md`: summary table of the files, with the identifier prefix of each domain.
- `docs/functional/<LANG>/NN-domain.md`: the rules of one domain. Each rule has a stable identifier (`PREFIX-TOPIC-NN`), a statement, its edge cases, and its reason when it is not obvious.
- `docs/functional/.last-sync`: one commit hash, the last commit whose changes the docs describe.

If `docs/functional/` does not exist, say so and stop: creating the first docs is a separate job.

## Anchor

- `.last-sync` missing, or not a commit of this repository: say so and stop. Do not guess a starting point.
- The hash is not an ancestor of `HEAD` (rewritten history): say so and stop.

## Steps

1. **Collect.** `git log --oneline <anchor>..HEAD`, then `git diff <anchor>..HEAD --stat` and the diffs of the files that carry behavior. Also look at `git status`: uncommitted changes are reported but **not** documented, and the anchor never moves past them.
   - Skip files that carry no rule: formatting, renames, design tokens, assets, tests, `docs/`, `sub-modules/`.
   - Keep what changes a decision: validation, limits, permissions, HTTP status codes and error messages the app translates, calculations, defaults, ordering, and screen behavior or texts that state a rule.
2. **Map to the rules.** For each behavior change, find the rules it touches: the header comment of the changed file (see below), then the README and the matching domain file. Read the whole rule before editing it.
3. **Update the docs** with the existing style:
   - a changed rule: edit its text in place, keep its identifier;
   - a new rule: add it to the right file with the next free identifier of its prefix, in the right section;
   - a rule that is no longer true: remove it, say so in the report, and never reuse its identifier;
   - keep README summaries, tables of contents and cross references correct.
4. **Fix the headers.** Every file that applies rules begins with a comment naming where they are described:
   - `/** Rules: docs/functional/FR/06-clubs.md (CLUBAPP-FICHE-*); server rules in the API repo (CLUB-ROLE-*). */`

   Name the file and the identifier **prefixes**, not each identifier. Add the header to a touched file that has none, fix a stale one. Do not add headers to files that carry no rule.

   If you format or lint, do it **on the files you touched only**, never on the whole repository: the project's formatter would also rewrite `sub-modules/` (the stack itself) and unrelated files. Check `git status` at the end: nothing outside `docs/` and the touched source files may have changed.
5. **Check the references.** Every identifier cited in `docs/` or in a header exists; every domain file is cited by the README. List the broken ones.
6. **Report**, short, as lists:
   - rules changed, added, removed;
   - headers added or fixed;
   - **doubts**: a behavior you could not tie to a rule, a rule you could not tell was still true, a change that contradicts a rule. Ask, do not decide;
   - uncommitted changes that will need a sync later.
7. **Move the anchor** only when the doubts are settled: write the hash of the last commit you read (`HEAD` at the start of the run) into `docs/functional/.last-sync`. Leave the diff for the user to review; do not commit.

## Never

- Invent a rule the code does not apply; when unsure, put it in the doubts.
- Document from the ticket tracker, from a comment, or from the other repository's code.
- Rewrite rules the commits did not touch.
- Commit, or push.
