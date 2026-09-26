---
description: async await try catch finally avoid Promise then catch finally hooks services stores screens components loaders Main App utils.
paths:
  - "hooks/**/*.ts"
  - "services/**/*.ts"
  - "screens/**/*.tsx"
  - "components/**/*.tsx"
  - "utils/**/*.ts"
---

# Async / await — no Promise chains

## Rule
- Prefer **`async` functions with `await` + `try` / `catch` / `finally`** for sequential async work.
- Do **not** chain **`.then` / `.catch` / `.finally`** on promises returned from APIs (e.g. `getX()`, `fetch`) when the same flow is clearer with `await`.

## Where it applies
- **`// -------- Init --------`** loaders invoked from `useEffect` (call with `void init(signal)`).
- Hooks, services call sites, and any non-library app code where you control the function shape.

## Why
- Same control flow as sync code; `finally` maps directly to “always stop loading”.
- Easier to add `AbortSignal` handling and typed errors later.

## Examples

### Good
```tsx
const init = useCallback(async (signal: AbortSignal) => {
  setLoading(true);
  try {
    const dto = await getPublicLegalLinks({ signal });
    setLegalLinks({ cguUrl: dto.cguUrl ?? null, privacyUrl: dto.privacyUrl ?? null });
  } catch {
    // intentional swallow or handle
  } finally {
    setLoading(false);
  }
}, []);
```

### Bad
```tsx
const init = useCallback((signal: AbortSignal) => {
  setLoading(true);
  void getPublicLegalLinks({ signal })
    .then((dto) => {
      setLegalLinks({ ... });
    })
    .catch(() => {})
    .finally(() => {
      setLoading(false);
    });
}, []);
```

## Exceptions
- **True fan-out**: `Promise.all` / `Promise.allSettled` with multiple independent promises — keep those APIs.
- **Third-party / one-liner** APIs that only expose a fluent chain — wrap in `async` and `await` the promise they return if that is cleaner.

## Related
- Init placement and `useEffect` orchestration: **useEffect (no inline functions)** rule under `component-rules/`.
