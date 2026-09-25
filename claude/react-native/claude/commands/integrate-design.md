---
description: Give context at the start of a session for integrating a new design (a Claude Design artifact, an exported HTML/CSS prototype, a screenshot, a Figma export) into a screen/feature, following the existing component stack instead of vibe-coding the whole thing at once.
---

# Integrate design

ARGUMENTS: describe what you want to build and where the design reference lives (path to a prototype file, name/link of the Claude Design artifact or project, screen(s) affected).

## Ground rules for this session

- The design reference is a **visual reference only** — layout, spacing, colors, hierarchy, interactions. Never read it as source to translate: don't copy or adapt its raw markup/CSS/inline styles into the app.
- Before building anything new, check `components/ds/*` and `components/ds/composed/*` (and existing screens) for components that already cover parts of the design. Reuse first, create only what's genuinely missing.
- Work **one component/screen at a time**:
  1. Propose a short plan for that unit — which existing components are reused, what's new, where it lives in the file structure.
  2. Wait for approval before writing code.
  3. Keep it as its own reviewable diff — never generate a full screen or app in one pass.
- Every other rule in `.claude/rules/` still applies exactly as if there were no reference design (icons via `DsIcon`, modals via `DsModal`, tokens, spacing, naming, etc.).
