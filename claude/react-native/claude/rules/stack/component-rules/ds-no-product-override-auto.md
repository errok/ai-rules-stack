---
description: Product apps never fork Ds* primitives or ds/composed — missing API goes to main via /promote-ds; product chrome lives in components/ not components/ds.
paths:
  - "components/ds/**"
  - "design-tokens/components/ds/**"
---

# Product apps do not override the DS

A product branch **consumes** `Ds*` as shipped on stack `main`. It does **not** fork DS sources.

**Same contract for both layers** — `components/ds/*` (primitives) and `components/ds/composed/*` (`DsFab`, `DsModal`, `DsIconButton`, tiles, …). Composed is still the stack. It is **not** a product skin folder.

## Allowed on the product branch

- Rebind **primitives / semantic** (theme: palette, type faces, `surface.ghost` values).
- App widgets under `components/` **without** the `Ds` prefix (`Halo`, `TaskRow`, `ChoiceRow`, …).

## Forbidden

- Edit `components/ds/**` **or** `components/ds/composed/**` for product-only visuals or behavior (gradient CTA, pill FAB, font fallbacks, extra variants that exist only here).
- Fork `design-tokens/components/ds/**` that any `Ds*` owns (`button.js`, `fab.js`, `chip.js`, …) for a product look.

## If the DS is “not enough”

| Need | Where |
|---|---|
| Missing **prop / variant / token role** other apps should have | Land it on **`main`** with `/promote-ds` (neutral API + stack hex) |
| Product **chrome / layout / brand treatment** | New widget in **`components/`** (compose `Ds*`, no `Ds` prefix). **Not** a new file under `ds/composed`. |

Do **not** patch `DsButton.tsx` or `DsFab.tsx` (or any other `Ds*`) on the product branch. Either `main` already expresses it, or the screen uses a product component.

After rebase onto `main`, `git diff main -- components/ds` must be empty (aside from an in-progress `/promote-ds` checkpoint). That path **includes** `ds/composed`. Same for DS-owned `design-tokens/components/ds/**`. App-owned token modules that pair with `components/` widgets (`halo.js`, …) may differ.
