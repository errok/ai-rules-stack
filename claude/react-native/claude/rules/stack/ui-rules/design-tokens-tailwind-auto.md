---
description: NativeWind tailwind.config primitives semantic component tokens typography blocklist gradients withAlpha design-tokens tailwind dirs, rebrand, importing a design, generic token names, light/dark themes, reverse roles.
globs: tailwind.config.js,design-tokens/**,tailwind/**
---

# Design tokens and Tailwind

## Token layers (do not skip)

1. **Primitives** — raw values (palettes, numeric scales). Not for direct use in UI classes.
   - Colors: `design-tokens/primitives/colors.js`
   - Box shadows: `design-tokens/primitives/boxShadow.js` (when present)
   - Typography scales / font face names: `design-tokens/primitives/typography.js` (must stay aligned with fonts loaded at **app bootstrap** / your font loader, e.g. Expo Google Fonts)

2. **Semantic** — roles and intent (e.g. `action.default`, `foreground.muted`). Prefer these over primitives for theme consistency.
   - Colors: `design-tokens/semantic/colors.js` (exports `{ light, dark }` — `dark` may be empty until themed)
   - Typography tuples for the plugin / JS consumers: `design-tokens/semantic/typography.js` (when present)

3. **Component** — map UI parts to semantic tokens (e.g. `button.primary.default.background`).
   - **Shared Tailwind bridge (screens / non-DS only):** `design-tokens/components/colors.js` (`foreground`, `background`, `navigation`, …) — not per-component palettes
   - **DS primitives:** `design-tokens/components/ds/{name}.js` (`button`, `card`, `container`, `icon`, …) — JS-only, consumed by `Ds*` via `style`
   - **DS composed:** `design-tokens/components/ds/composed/{name}.js` (`modal`, `tabs`, `tile`, …) — same contract, mirrors `components/ds/composed`
   - **Non-DS widgets:** `design-tokens/components/{name}.js` (`menu`, app-owned `halo`, …)
   - Typography for `DsText`: `design-tokens/components/ds/typography.js`

**Flow:** primitives → semantics → components. Rebrand by changing primitives; add dark mode by filling `dark` modules and wiring in `tailwind.config.js`.

## Token names are the contract

Primitive and semantic names are **generic on purpose** — `primary`, `secondary`, `tertiary`, `neutral`, `alert`, `action.default`, `foreground.muted`. A name never references a hue, so a rebrand changes **values only** and no consumer moves.

- **Rebranding / importing an external design** (Claude Design artifact, Figma export, screenshot): the project's primitives are **master**. Work out which incoming color maps onto which existing generic name and **replace its values**. Never import the design's own palette names (`steel`, `cyan`, …), and never add a parallel group to sidestep the remapping — a hue-named token forces a rename the day another color arrives.
- **Exception:** font-family token names name a real font file, so swapping the font does rename them (`roboto` → `inter`, …). Type **scales** stay put: reuse the existing sizes, adjust one only if the design truly demands it.
- A rebrand is **not finished at the primitive layer**. Re-read every component token module: a palette flip silently inverts any slot wired to `background.reverse` / `foreground.reverse` (card borders, menu labels, tile sheen), and washes out slots wired to an accent that changed hue. Resolve the modules in Node and compare the hex against the design before calling it done.

## `light` / `dark` and the `reverse` roles

- **`light` is the default theme whatever its luminosity** — if the product's design is dark, it lives in `light` all the same, and `dark` stays `{}`. A real second theme then costs nothing: move `light` into `dark`, author a new `light`, no consumer to touch.
- **`*.reverse` is relative to the current theme**, not a fixed light or dark value: it means the inverse of the theme, for contrast. A contrasting panel takes `background.reverse` + `foreground.reverse`, so a component needs one key instead of one per theme.
- On a **theme** surface use `default` / `muted`; on a deliberately inverted surface use the `reverse` pair. Surfaces of **fixed** luminosity (a full-bleed photo or camera preview, a hardcoded splash background) are not inverted surfaces — they follow whichever key matches their own luminosity, and therefore change key if the theme's luminosity flips.

## `tailwind.config.js`

- **Single entry** for NativeWind: requires token modules from `design-tokens/`, sets `theme.extend.colors.light` / `dark`, `boxShadow`, etc.
- Keep the **file header comment** in sync when adding or renaming token files.
- **Plugins:** only if present under `tailwind/plugins/` (e.g. typography) — do not assume they exist.
- **Blocklist:** `tailwind/blocklist.js` — do not remove restrictions without team agreement (enforces tokens over default Tailwind palettes; disables `space-*` because NativeWind v4 native does not support it — use `gap-*` on flex parents).

## Usage

- **`Ds*`:** never use semantic or `colors.js` Tailwind color classes (`bg-light-background-default`, `text-light-foreground-muted`, …). Freeze the component; restyle only via its token module (`style`).
- **Screens / non-DS:** prefer `colors.js` utility classes over primitives or raw hex (blocklist blocks default Tailwind palettes).
- **Gradients** only if wired in config (e.g. `theme.extend.gradient.light`).
- **Alpha helpers:** `design-tokens/utils/withAlpha.js` when building transparent variants in token files.

## Related

- Global stack and folders: **Project architecture** (core rules, always on)
- **New `Ds*` component checklist:** `component-rules/ds-new-component-auto.md`
- SVG / icon tinting: **SVG assets** under `ui-rules/`
