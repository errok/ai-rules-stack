---
description: ds vs ds/composed layering primitives vs composed DsIconButton DsModal DsErrorModal; DsButton DsContainer DsIcon same folders plus screens using composed chrome.
paths:
  - "components/ds/**"
  - "screens/**/*.tsx"
---

# Design system — UI layering (`ds` vs `ds/composed`)

## Intent
Keep UI architecture maintainable by separating:
- **Primitives** (`components/ds`) from
- **Composed DS** (`components/ds/composed`)

Both folders are **stack DS** — product apps must not fork either (see **Product apps do not override the DS**).

## Folder boundaries
- `components/ds/*` = low-level primitives with minimal orchestration.
  - Examples: `DsText`, `DsButton`, `DsIcon`, `DsContainer`, `DsScrollView`.
- `components/ds/composed/*` = generic compositions built from primitives (still stack-owned).
  - Examples: `DsModal`, `DsIconButton`, `DsFab`, `DsErrorModal` / `DsErrorModalHost`, `DsSegmentedButtons`, `DsInput`, tiles.

## Naming convention
- Components in `components/ds` use prefix **`Ds`**.
- Composed widgets live under `components/ds/composed` (same `Ds` prefix).

## Button policy
- `DsButton` is a **text/action button**.
- Do **not** encode icon-only behavior in `DsButton` (e.g. no `size="icon"` pattern).
- Use `DsIconButton` for icon-only taps.

## Icon usage
- `DsIconButton` should consume icon names from `DsIcon` (`iconName: EDsIconName`) instead of importing raw SVGs directly.

## Practical rule of thumb
- If a component introduces **generic** UX orchestration (layout composition, modal behavior, flows, variant branching), it belongs to `ds/composed`.
- If it can be reused as a generic primitive building block, it belongs to `ds`.
- If it is **product** chrome (domain row, brand CTA, halo), it belongs to `components/` — not `ds/composed`.
