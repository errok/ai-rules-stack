---
description: React Navigation navigation/ param lists route enums native-stack bottom tabs mirror existing *.types.ts files.
paths:
  - "navigation/**"
---

# React Navigation — `navigation/`

**Canonical reference:** mirror an existing stack folder under `navigation/private/{section}/` or `navigation/public/` (same patterns: `*Stack.tsx`, `{section}.types.ts`, enums, param list).

## Vocabulary — `Stack` vs `Navigator`

| Symbol | When | Example |
|---|---|---|
| **`*Stack`** | Native stack navigator (screens pushed in a domain section) | `HomeStack`, `SettingsStack`, `PublicStack` |
| **`*Navigator`** | **Bottom tab menu only** (hosts stacks as tab screens) | `BottomTabNavigator` |
| **`RootNavigator`** | Auth-status gate at app root (public vs private shell) — not a stack, not the tab menu | `RootNavigator` |

Do **not** name domain stacks `*Navigator` (`HomeNavigator`, `SettingNavigator`, …). **Navigator** is reserved for the tab menu.

## Folder layout — private stacks

One **lowercase section folder** per domain stack, co-located types:

```
navigation/private/
  home/
    HomeStack.tsx       # export HomeStack
    home.types.ts       # EHomeRoutes, EHomeStack, THomeStackParamList, …
  settings/
    SettingsStack.tsx   # export SettingsStack (file name = export)
    settings.types.ts
  BottomTabNavigator.tsx
  bottomTab.types.ts
```

```
navigation/public/
  PublicStack.tsx
  public.types.ts
```

- Types file: `{section}.types.ts` in the same folder (`home.types.ts`, `settings.types.ts`).

## Per-stack types file (`{section}.types.ts`)

1. **Stack key** (for redirects / deep links) — e.g. `EHomeStack`, often aligned with the parent tab route (`ERootTabRoutes.Home`).
2. **Redirect actions** — `E{Name}StackRedirect` when using `useRedirectStore`.
3. **Route name enum** — `E{Name}Routes`, `as const`, PascalCase keys, string values = React Navigation `name` props.
4. **Param list** — `T{Name}StackParamList`; import screen param types from screen files when non-trivial.
5. **No magic strings** — `navigate`, `initialRouteName`, `route.name` comparisons use `E*Routes.*`.

## Stack component (`{Name}Stack.tsx`)

```tsx
const Stack = createNativeStackNavigator<THomeStackParamList>();

export function HomeStack() {
  return (
    <Stack.Navigator …>
      <Stack.Screen name={EHomeRoutes.HomeMain} component={…} />
    </Stack.Navigator>
  );
}
```

- Reuse `navigation/navigationConfig.tsx` (`stackScreenOptions`, `getStackHeaderLeft`, …).
- Optional `withRedirectHandler` HOC on the stack **entry screen** (see `HomeStack.tsx`).

## Bottom tab menu (`BottomTabNavigator.tsx`)

- Hosts `HomeStack`, `SettingsStack`, … as `Tab.Screen` components.
- Tab route names: `bottomTab.types.ts` → `ERootTabRoutes`, `TRootTabParamList`.
- `popToTopOnBlur: true` on tabs when nested stacks should reset on tab switch.

## Root shell

- `navigation/RootNavigator.tsx` — switches on auth status (`PublicStack`, `BottomTabNavigator`, onboarding, error).

## Cross-cutting

- Adding/renaming a screen → update `{section}.types.ts`, `{Name}Stack.tsx`, redirect switch if any.
- Keep `types/navigation.ts` re-exports aligned with `{section}.types.ts` paths.
