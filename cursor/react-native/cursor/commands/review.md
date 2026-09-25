---
description: Review current git diff against project rules; advice only when warranted
---

# Diff review (rules + quality)

## Goal

Review **the full uncommitted diff** (or whatever diff the user explicitly scopes), check it against **repo conventions** (`.cursor/rules/`, project architecture), and **suggest changes only when genuinely useful**.  
If the diff is clean and aligned: say so plainly — **no forced nitpicks** to pad the answer.

## Input

- **Default**: diff = everything that differs from `HEAD` (modified / added files, staged or not).
- **If the user narrows scope** (paths, branch, commit range): use that scope instead.

## Steps (agent)

1. **Collect the diff**
   - `git diff HEAD` (and when useful `git diff --stat HEAD`, `git status`) for the full picture of work in progress.
   - If the diff is empty: report that and stop.

2. **Pick relevant rules**
   - Read at least the workspace **always-applied** rules (e.g. architecture, naming).
   - For each area touched by the diff, open rules whose **globs** or **description** match (`component-rules/`, `service-rules/`, `store-rules/`, `ts-rules/`, etc.) — stay proportional to the diff; do not load everything blindly.

3. **Analyze the diff**
   - Project patterns (AppNative vs raw RN, `r` / fetch, auth, stores, `Screen` / `Dto` / `T` / `E` suffixes, etc.).
   - Consistency with existing files (style, imports, structure).
   - Obvious regression risks (public API, navigation, Tailwind tokens / `tailwind.config`, env).
   - **Do not** invent minor or subjective issues if nothing violates the rules or repo consistency.

4. **Deliverable — language**
   - **Write the entire user-facing deliverable in French** (summary, verdict, and any change recommendations). The command text is in English for tooling clarity; the answer to the user stays French.

5. **Deliverable — content**
   - **Short summary**: what the diff does (1–3 sentences).
   - **Verdict**: OK / OK with caveats / needs fixes — briefly justified.
   - **Change recommendations**: **only** when there is a clear rule gap, a likely bug, or avoidable debt — give **concrete** actions (file + principle), not a generic best-practices list.
   - If all good: a line like « Rien à signaler par rapport aux rules relevées » — **no** artificial « optional improvements » section.

## Do not

- Demand changes just to sound thorough.
- Rewrite the whole diff or propose a large refactor when the current scope is healthy.
- Cite rules you did not read or that do not apply to the diff.
