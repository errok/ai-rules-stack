---
description: Shared Markdown wrapper react-native-markdown-display reverse prop theme-inverted vs theme surfaces typography lists co-located styles helper.
globs: components/**/*.tsx,screens/**/*.tsx
---

# Markdown display (rich text wrapper)

## Usage
- Prefer one shared **Markdown** wrapper for rich text; avoid wiring `react-native-markdown-display` directly in many places.
- The **`reverse`** prop is for surfaces **inverted relative to the current theme** (a contrasting panel on `background.reverse`). On ordinary theme surfaces (app shell, standard modals), omit `reverse` or contrast will be wrong — align with the **screen/component structure** rule (semantic foreground section) and the `reverse` roles in **design tokens & Tailwind**.

## Changes
- Keep display styles centralized in one module (e.g. a `markdownMainStyle`-style helper) so list markers, headings, and links stay aligned with design tokens.
