---
description: useEffect no inline async anonymous function declare loader Init Callbacks useCallback dependency array screens components React Native.
paths:
  - "components/**/*.ts"
  - "components/**/*.tsx"
  - "screens/**/*.tsx"
---

# `useEffect` — no inline functions

## Rule
- Do **not** declare anonymous / inline functions inside `useEffect` bodies (e.g. `const load = async () => { ... }` inside the effect).
- Instead, declare the function in the component body under the appropriate section:
  - **`// -------- Init --------`** for data loaders / initializers
  - **`// -------- Callbacks --------`** for event handlers passed to JSX
  - Wrap with `useCallback` when it is referenced by `useEffect` or passed to children.

## Why
- Prevents accidental dependency loops (state in deps + state set in effect).
- Makes effects read as orchestration only (call a named function, cleanup).
- Improves diff readability and refactoring safety.

## Examples

### ✅ Good
```tsx
// -------- Init --------
const loadScores = useCallback(async () => {
  // ...
}, [/* deps */]);

// -------- Effects --------
useEffect(() => {
  void loadScores();
}, [loadScores]);
```

### ❌ Bad
```tsx
useEffect(() => {
  const loadScores = async () => {
    // ...
  };
  void loadScores();
}, []);
```
