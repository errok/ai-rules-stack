---
description: Embedded web forms Typeform shared FormWebView onComplete locale headers not ad-hoc WebView per screen.
globs: components/**/*.tsx,screens/**/*.tsx
---

# Form WebView — shared wrapper

## Goal
Centralize embedded web forms behavior (language, headers, completion detection, error handling) and avoid copying WebView glue code across screens.

## Rules
- When embedding a form (Typeform or equivalent), use the **shared form WebView** component from your `components/` tree (single implementation for the app).
- Do not create new screen-local `WebView` wrappers unless there is a strong reason (and then extract a reusable component).
- Completion must be handled via `onComplete()` (screen decides what to do next).

## Notes
- The shared wrapper should inject the desired locale (e.g. `navigator.language`) and send matching `Accept-Language` headers.
- It should listen for the provider’s completion signal (e.g. a JSON message) and then call `onComplete()`.
