---
name: optimize-rule-attachment
description: Tune Continue rule globs and descriptions so auto-attached context stays small and rules stay reusable
invokable: true
---

# Optimize rule attachment (globs + descriptions)

Use this when refactoring `.continue/rules/` so **fewer rules load automatically** on each edit, while conventions stay discoverable via **descriptions** (and optional @-mentions only when needed).

**Repos:** same workflow for a **client app** (e.g. TypeScript under `src/` or repo root) and a **Go API** (e.g. code under `app/`). Work from the **target repository root**; path examples below are illustrative—**globs must match that repo’s tree**.

---

## Goal (what “good” looks like)

1. **`globs`** — **repo-specific is OK** (and expected). They exist to **scope auto-attachment** to the folders where the rule matters. Tune them: tight enough to limit noise, wide enough that the team does **not** have to @-mention rules during normal work.
2. **Everything else** — **`description`, body text, examples, and cross-references should stay as generic as possible** so you can **reuse or fork** the same rules in other projects with minimal search-replace.
   - Avoid **one-off filenames** and **business-only paths** in prose (no “see `screens/foo/Bar.tsx`”).
   - Prefer **concepts and roles**: “root navigator”, “HTTP client helper”, “auth public barrel”, “composed modal”.
   - Examples: **placeholder** names (`FeatureScreen`, `UserDto`, `EExampleRoutes`)—not real product modules.
   - **Cross-rules:** point by **intent / category** (“the **Naming** always-rule”, “the **modals** rule under `component-rules/`”), not by embedding another rule’s **filename**.
3. **Autonomous attachment** — if nobody should rely on manually attaching context, **do not leave `globs` empty** for rules that must govern everyday edits. Prefer the **smallest glob that still hits those files**; **some overlap** between rule files is acceptable if it keeps attachment automatic.
4. **`alwaysApply: true`** only for true **repo-wide maps** (architecture + naming, etc.); widen rarely.

---

## Principles (mechanics)

1. **Tight globs for narrow domains** — smallest subtree where the rule should auto-attach.
   - **Client (TS/RN):** e.g. `services/**`, `stores/**`, `components/<area>/**` — avoid blanket `**/*.tsx` unless unavoidable.
   - **API (Go):** e.g. `app/services/**`, `app/controllers/**`, `app/router/**` — avoid blanket `app/**/*.go` unless the rule is universal for that repo.
2. **Keyword-rich `description`** — stack tokens (folders, public API symbols, flows) so retrieval still works when globs are narrow. Keep wording **product-agnostic** (no unique file paths in the `description` line).
3. **Glob YAML (Continue)** — prefer a YAML list of quoted globs, or a single quoted string:
   ```yaml
   globs:
     - "services/**"
     - "stores/**"
   ```
4. **Required `name:`** — every Continue rule needs a display `name` in frontmatter.
5. **No duplicated guidance** — before splitting a topic across two rules, check the **rule manager** (core rules) for globs vs. description attachment guidance.

---

## Workflow (agent steps)

1. From the **target repo root**, list `**/.continue/rules/**/*.md` and read each frontmatter (`name`, `description`, `globs`, `alwaysApply`). Use `git -C <absolute-path-to-repo>` (or set shell `working_directory` to that root) so paths resolve correctly.
2. Flag **overly broad globs** and **redundant overlap** (overlap is OK when it preserves autonomous attachment).
3. For each candidate rule:
   - Adjust **`globs`** to the best trade-off: small context window + still attaches where enforcement matters.
   - Rewrite **`description` and body** toward **portable** language; strip project-only file references in favor of rule **titles** and **folder categories**.
4. Ensure frontmatter follows Continue format (`name`, quoted YAML globs when listed).
5. After edits: no empty **`description`** unless intentional.

---

## Deliverable

- Concrete edits to `.md` frontmatter and body where needed.
- Short summary: which **globs** changed, which rules were **merged/split**, and what was **generalized** for reuse.
