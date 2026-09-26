---
description: PascalCaseScreen screens PascalCase components no Screen suffix on components filename matches export no React.FC T{Name}ScreenParams TReactNavigation RouteProp comment sections NativeWind DsCard barrels Markdown reverse navigation shell structure.
paths:
  - "screens/**/*.tsx"
  - "components/**/*.tsx"
  - "components/ds/index.ts"
  - "components/ds/composed/index.ts"
  - "navigation/**/*.tsx"
---

# Components & Screens — Structure Conventions

## React Navigation — route params and `navigation` typing

- **Route params type** lives in the **same file** as the screen (co-located). Name it `T{Name}ScreenParams`. Example: `TCheckoutScreenParams` next to `CheckoutScreen`.
- **Screen props** use that type for `route` via `RouteProp`, and **`navigation` is always `TReactNavigation`** from `types/react.types` — do not use raw `StackNavigationProp<...>` or ad-hoc navigation types on screens unless `TReactNavigation` is genuinely insufficient (rare).
```tsx
import type { RouteProp } from '@react-navigation/native';
import type { TReactNavigation } from 'types/react.types';

export type TFeatureScreenParams = {
  itemId: number;
  // ...
};

type FeatureScreenProps = {
  navigation: TReactNavigation;
  route: RouteProp<Record<string, TFeatureScreenParams>, string>;
};
```
- When a stack defines a **central param list** (e.g. `*.types.ts` next to the navigator), prefer `RouteProp<ThatParamList, 'ScreenName'>` for stricter typing while still using `TReactNavigation` for `navigation`.

## Mandatory section structure
Every component and screen must include these comment sections in order.
If a section is empty, keep the comment — it signals the section is intentionally empty.

**Spacing:** each structure comment (`// -------- … --------`) must have **one blank line above and one blank line below** — never glue the banner to the previous/next statement.

```tsx
// -------- Params --------
// Route params type: co-located `T{Name}ScreenParams` (suffix `Params`). See "React Navigation" section above.

// -------- Store --------

// -------- Hooks --------

// -------- States & Refs --------

// -------- Init --------

// -------- Helpers --------

// -------- Callbacks --------

// -------- Effects --------

// -------- Renderers --------

// -------- Loading --------

// -------- Error --------

// -------- No data -------- (optional if needed)

// -------- Main renderer --------
```

## Styling
- Use NativeWind Tailwind classes as primary styling method
- `StyleSheet.create()` is acceptable for dynamic styles or complex cases only
- No inline style objects: `style={{ marginTop: 8 }}` is forbidden unless truly dynamic

## Semantic foreground
- `DsText` `color="foreground-reverse"` and `Markdown` `reverse` are meant for surfaces **inverted relative to the current theme** — a contrasting panel built on `background.reverse`. They resolve to ink that contrasts with that panel, not to a fixed light or dark value.
- On ordinary **theme** surfaces (modals, cards, the default app background), use `foreground-default` / `foreground-muted` and Markdown **without** `reverse`, or content will look “missing” (low contrast).
- A surface of **fixed** luminosity (camera preview, hardcoded splash background) is not an inverted surface: pick the key matching its own luminosity. See **design tokens & Tailwind** (`ui-rules/`).

## Comments
- Comment only non-obvious logic (intent, constraint, workaround)
- Comments in English only
- Do not add commented-out dead code

## Pressable vs display cards
- **`DsCard`** is for **display-only** surfaces — do not add `onPress` / primary tap handling to it.
- Use a **`Pressable`** / touchable wrapper (or another explicit pressable card) when the whole card must be tappable.

## Local vs global components
- If a component is used in only one screen → place it in the screen's folder
- If a component is reused across screens → move it to `components/`

## Barrel `index` files (re-exports)
- Do **not** add an `index.ts` / `index.tsx` whose **only role** is to re-export sibling modules in the same folder (barrel / `export { … } from './…'`). Import concrete files instead (e.g. `./MyFeature/MyFeatureList`).
- **Single exception:** the **repository root** entry file only (`index.js`, `index.ts`, or `index.tsx` next to `app.json` / `package.json`), e.g. Expo `registerRootComponent` — required by the bundler. Path aliases do not change this.
- **Stack exceptions:** `components/ds/index.ts` and `components/ds/composed/index.ts` are allowed as curated public export surfaces.
- A folder may still use `index.tsx` / `index.ts` as the **main source file** of one component (real implementation, not re-exports only); that is not a barrel.
- Other re-export barrels (e.g. `services/auth/index.ts`) exist for historical reasons — **do not add new ones** for new features.
