---
description: handlePress handleClose handleSubmit handleOpen useCallback JSX onPress onClose event handler naming handle prefix screens components.
paths:
  - "components/**/*.tsx"
  - "screens/**/*.tsx"
---

# Callback Naming — `handle` Prefix

Any function that is *invoked by a component* (typically passed to JSX as an event handler or callback prop) must be prefixed with `handle`.

This includes patterns like:
- `onPress={handleX}`
- `onClose={handleX}`
- `onChange={handleX}`
- `useCallback(() => ..., ...)` functions passed down as props to child components

## Examples

```tsx
// ✅ Good
const handleSubmit = useCallback(async () => {
  await api.submit();
}, []);

return <DsButton title="Submit" onPress={handleSubmit} />;
```

```tsx
// ❌ Bad
const submit = useCallback(async () => {
  await api.submit();
}, []);

return <DsButton title="Submit" onPress={submit} />;
```

## Notes / Edge Cases
- Pure render helpers used only inside the same component (not passed to JSX as handlers/props) may keep their current names.
- Effects and data loaders can keep their existing names (e.g. `load`, `fetchX`) as long as they are not directly wired as component callbacks.
