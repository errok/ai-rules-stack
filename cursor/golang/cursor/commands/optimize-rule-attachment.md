---
description: Tune Cursor rule globs and descriptions so auto-attached context stays small and rules stay reusable
---

# Optimize rule attachment (globs + descriptions)

Use this when refactoring `.cursor/rules/` so **fewer rules load automatically** on each edit, while conventions stay discoverable via **descriptions** (and optional @-mentions only when needed).

**Repos:** same workflow for a **client app** (e.g. TypeScript under `src/`) and a **Go API** (flat layout at repo root: `controllers/`, `services/`, `router/`, etc.). Work from the **target repository root**; path examples below are illustrative—**globs must match that repo’s tree**.

---

## Goal (what “good” looks like)

1. **`globs`** — **repo-specific is OK** (and expected). They exist to **scope auto-attachment** to the folders where the rule matters. Tune them: tight enough to limit noise, wide enough that the team does **not** have to @-mention rules during normal work.
2. **Everything else** — **`description`, body text, examples, and cross-references should stay as generic as possible** so you can **reuse or fork** the same rules in other projects with minimal search-replace.
   - Avoid **one-off filenames** and **business-only paths** in prose (no “see `screens/foo/Bar.tsx`”).
   - Prefer **concepts and roles**: “root navigator”, “HTTP client helper”, “auth public barrel”, “composed modal”.
   - Examples: **placeholder** names (`FeatureScreen`, `UserDto`, `EExampleRoutes`)—not real product modules.
   - **Cross-rules:** point by **intent / category** (“the **Naming** always-rule”, “the **modals** rule under `component-rules/`”), not by embedding another rule’s **filename** (`*-auto.mdc`).
3. **Autonomous attachment** — if nobody should rely on manually attaching context, **do not leave `globs` empty** for rules that must govern everyday edits. Prefer the **smallest glob that still hits those files**; **some overlap** between rule files is acceptable if it keeps attachment automatic.
4. **`alwaysApply: true`** only for true **repo-wide maps** (architecture + naming, etc.); widen rarely.

---

## Principles (mechanics)

1. **Tight globs for narrow domains** — smallest subtree where the rule should auto-attach.
   - **Client (TS/RN):** e.g. `src/services/**`, `src/stores/**`, `src/components/<area>/**` — avoid blanket `src/**/*.tsx` unless unavoidable.
   - **API (Go):** e.g. `services/**`, `controllers/**`, `router/**` — avoid blanket `**/*.go` unless the rule is universal for that repo.
2. **Keyword-rich `description`** — stack tokens (folders, public API symbols, flows) so retrieval still works when globs are narrow. Keep wording **product-agnostic** (no unique file paths in the `description` line).
3. **Glob YAML** — in frontmatter, write `globs` **without** surrounding double quotes (prefer one comma-separated line).
   - **Correct:** `globs: src/services/**` or `globs: controllers/**/*.go,router/**`
   - **Wrong:** `globs: "src/services/**"` or YAML list items with quoted paths
4. **No duplicated guidance** — before splitting a topic across two rules, check the **rule manager** (core rules) for globs vs. description attachment guidance.

---

## Workflow (agent steps)

1. From the **target repo root**, list `**/.cursor/rules/**/*.mdc` and read each frontmatter (`description`, `globs`, `alwaysApply`). Use `git -C <absolute-path-to-repo>` (or set shell `working_directory` to that root) so paths resolve correctly.
2. Flag **overly broad globs** and **redundant overlap** (overlap is OK when it preserves autonomous attachment).
3. For each candidate rule:
   - Adjust **`globs`** to the best trade-off: small context window + still attaches where enforcement matters.
   - Rewrite **`description` and body** toward **portable** language; strip project-only file references and **`.mdc` cross-links** in favor of rule **titles** and **folder categories**.
4. Ensure `globs` lines follow the **unquoted** form (principle 3).
5. After edits: no empty **`description`** unless intentional.

---

## Deliverable

- Concrete edits to `.mdc` frontmatter and body where needed.
- Short summary: which **globs** changed, which rules were **merged/split**, and what was **generalized** for reuse.
