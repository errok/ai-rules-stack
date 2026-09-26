---
description: DsModal vs DsModalFullScreen EDsModalMode Center BottomSlide MODAL_MODE_CONFIG react-native-modal product dialogs screens.
paths:
  - "screens/**/*.tsx"
  - "components/**/*Modal*.tsx"
---

# Modals — `DsModal` vs `DsModalFullScreen`

## Intent
- **`DsModal`** (composed modal under `ds/composed/`) is the **default** in-app dialog: header (optional `title` + close), scroll body, themed overlay. Use it for product modals (centered card or bottom sheet).
- **`DsModalFullScreen`** (primitive under `ds/`, name may vary) is a **full-screen** `react-native-modal` wrapper that **forwards** underlying modal props. Reserve it for cases that need low-level control (e.g. full-screen takeover, custom animation props passed through).

## `DsModal` API
- **Do not** spread or re-expose the full `react-native-modal` prop surface on `DsModal`. Keep the public props explicit (`isVisible`, `onClose`, `title`, `mode`, `containerClassName`, etc.) so behavior stays consistent.
- **Modes** are selected with **`EDsModalMode`** (`Center`, `BottomSlide`). Layout, animations, and max heights are driven by **`MODAL_MODE_CONFIG`** — when adding a new mode, extend the enum and add one config entry (animations, `modalStyle`, container classes, `surfaceClassName`, optional `maxHeight`).
- **Imports:** import `DsModal` / `EDsModalMode` from your composed modal module (or the curated `ds/composed` barrel if you use one).

## Defaults wired in `DsModal`
- Backdrop: theme overlay color; `onBackdropPress` / `onBackButtonPress` call `onClose` when provided.
- Bottom slide: full width, max height ~60% of window; centered mode: horizontal inset via container classes, max height ~80% of window.

## When to use which
| Need | Use |
|------|-----|
| Standard dialog / bottom sheet with title + scroll | `DsModal` |
| Full-screen modal or must pass many `react-native-modal` props | `DsModalFullScreen` |
| Raw `Modal` from RN or `react-native-modal` in a screen | Avoid — prefer one of the above |
