---
description: DsIcon EDsIconName registry centralized icon component raw SVG assets only when missing from registry IconButton tint size.
globs: components/**/*.tsx,screens/**/*.tsx
---

# Icon Handling — Centralize via `DsIcon`

When a component needs to display an icon that already exists in the **central icon registry** (the `DsIcon` / `EDsIconName` source under `components/ds`), use `DsIcon` instead of importing raw SVGs from `assets/icons/...`.

## Why
- Centralizes the icon registry (names, sizing, semantic colors)
- Prevents ad-hoc icon imports that bypass the design conventions

## Do
```tsx
import { DsIcon } from 'components/ds';

<DsIcon name="arrowRightNav" size={28} color="#0F172A" />
```

## Don't
```tsx
import ArrowRightNav from 'assets/icons/arrow-right-nav.svg';

<ArrowRightNav width={28} height={28} color="#0F172A" />
```

## Exceptions
- If the icon is **not present** in `DsIcon`’s `EDsIconName` registry, importing the raw SVG is allowed (but prefer adding it to `DsIcon` once identified as needed).
- Background images (e.g. using SVGs as artwork in a `Image`/`ImageBackground`) are not considered “standard icons” and can remain as-is.
