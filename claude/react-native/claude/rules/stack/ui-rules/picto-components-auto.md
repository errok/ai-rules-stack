---
description: Pictograms (pictos) as reusable UI components live under components/Picto; avoid ad-hoc copies; keep API simple (size/color/circle).
paths:
  - "components/**/*Picto*.tsx"
---

# Picto components — `components/Picto/*`

## Goal
Keep pictograms consistent (API, styling, placement) and avoid duplicated “one-off” pictos spread across unrelated folders.

## Rules
- Reusable pictograms must live under `components/Picto/` (e.g. `components/Picto/FeaturePicto.tsx`).
- Do not create new `components/*Picto.tsx` at the root level; move it into `Picto/`.
- Picto components should expose a small, stable props surface:
  - `size` (number)
  - `color` (tint, usually token-resolved)
  - optional `withCircle` / `circleColor` when the design requires a circular background
- Use `DsIcon` for standard icons; use `Picto/*` for domain pictograms that are not part of the icon registry.
