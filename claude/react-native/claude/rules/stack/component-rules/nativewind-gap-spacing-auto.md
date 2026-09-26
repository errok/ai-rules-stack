---
description: NativeWind v4 spacing — gap-* on flex parent, limit child margins (mt/mb/ml/mr), never space-x space-y
paths:
  - "components/**/*.tsx"
  - "screens/**/*.tsx"
---

# NativeWind spacing — `gap-*` on parent, margins sparingly

## Rule

- Use **`gap-{n}`** on a **flex parent** (`flex flex-col` or `flex flex-row`) for spacing **between siblings**.
- **Limit child margins** (`mt-*`, `mb-*`, `ml-*`, `mr-*`) — avoid them for inter-sibling rhythm; let the parent own spacing.
- Do **not** use `space-x-*` / `space-y-*` (NativeWind v4 native = no-op; blocklisted).
- Do **not** use `gap-x-*` / `gap-y-*` — prefer **`gap-*`** (maps to Yoga `gap`; axis-specific variants are unreliable on native in this stack).
- Match layout: vertical stack → `flex flex-col gap-6`; horizontal row → `flex flex-row gap-4`.

## Why

- **Parent-controlled spacing:** one `gap-*` on the container; add/remove/reorder children without retouching each child's margin.
- NativeWind v4: `space-*` removed on native (no CSS child selectors).
- RN Yoga: unified `gap` works reliably; `rowGap` / `columnGap` (`gap-y` / `gap-x`) often fail to apply depending on parent flex setup.

## When margins are OK

- **Outer inset** from a screen/section edge (`mt-4` on a block below the header) when it is not spacing between siblings in the same stack.
- **Component-internal** padding/margin that is part of the component contract (e.g. icon inset inside a chip), not layout between arbitrary siblings.
- **Nested edge case** where `gap` misbehaves — explicit `mb-*` / `mr-*` on a child as a last resort.

## Examples

### ✅ Good (vertical)

```tsx
<View className="flex flex-col gap-6">
  <DsInput label="Email" … />
  <DsInput label="Password" … />
</View>
```

### ✅ Good (horizontal)

```tsx
<View className="flex flex-row items-center gap-4">
  <DsIcon name="info" />
  <DsText type="body">Hint</DsText>
</View>
```

### ❌ Bad — `space-*` / axis gap / missing flex

```tsx
<View className="gap-y-6">          {/* axis variant — avoid */}
<View className="space-y-6">       {/* native no-op */}
<View className="gap-6">            {/* missing flex — may not apply */}
```

### ❌ Bad — margins on every sibling (parent should use `gap`)

```tsx
<View>
  <DsInput className="mb-4" … />
  <DsInput className="mb-4" … />
  <DsButton className="mt-2" … />   {/* last child often needs a special case */}
</View>
```

### ✅ Good — same layout, parent owns rhythm

```tsx
<View className="flex flex-col gap-4">
  <DsInput … />
  <DsInput … />
  <DsButton … />
</View>
```
