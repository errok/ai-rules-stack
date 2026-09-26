---
description: Shared Markdown wrapper react-native-markdown-display reverse prop theme-inverted vs theme surfaces typography lists co-located styles helper.
paths:
  - "components/**/*.tsx"
  - "screens/**/*.tsx"
---

# Markdown display (rich text wrapper)

## Usage
- Prefer one shared **Markdown** wrapper for rich text; avoid wiring `react-native-markdown-display` directly in many places.
- Pass **`reverse`** only on surfaces inverted relative to the current theme — see the semantic foreground section of the **screen/component structure** rule.

## Changes
- Keep display styles centralized in one module (e.g. a `markdownMainStyle`-style helper) so list markers, headings, and links stay aligned with design tokens.
