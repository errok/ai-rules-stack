---
description: PascalCaseScreen screens PascalCase components no Screen suffix on components filename matches export no React.FC T{Name}ScreenParams TReactNavigation RouteProp comment sections NativeWind DsCard barrels Markdown reverse navigation shell structure.
globs: screens/**/*.tsx,components/**/*.tsx,components/ds/index.ts,components/ds/composed/index.ts,navigation/**/*.tsx
---
# Components & Screens — Structure Conventions

## TypeScript (tsx — same contracts as the **TypeScript conventions** rule under `ts-rules/`)
- Use `type` for data shapes, not `interface` (`useConsistentTypeDefinitions`)
- `import type` for type-only imports; no `any` (use `unknown` + guards)
- Full Biome / formatting list lives in the **TypeScript conventions** rule (auto-attached on `.ts` / navigators / typical entry modules)

## File naming

| Type | File name | Exported symbol | Example |
|---|---|---|---|
| Screen (nav entry point) | `PascalCase` + suffix `Screen` | Same as file (without `.tsx`) | `HomeScreen.tsx` → `HomeScreen` |
| Reusable component | `PascalCase` — **no** `Screen` suffix | Same as file (without `.tsx`) | `AvatarRow.tsx` → `AvatarRow` |
| Local screen sub-component | `PascalCase` — **no** `Screen` suffix (same screen folder) | Same as file (without `.tsx`) | `SettingsRow.tsx` → `SettingsRow` |
| Hook | `camelCase.ts` starting with `use` | Same as file (without `.ts`) | `useProfile.ts` → `useProfile` |

**Filename = component name.** The primary export must match the file basename (without extension). Do not use a `Screen` suffix on components — reserve it for navigation entry-point screens only.

```tsx
// ✅ HomeScreen.tsx
export const HomeScreen = ({ navigation }: HomeScreenProps) => { /* … */ };

// ✅ SettingsRow.tsx (local to a screen — not a nav entry point)
export const SettingsRow = ({ label }: SettingsRowProps) => { /* … */ };

// ❌ settings.tsx with export const SettingsScreen — wrong file name
// ❌ SettingsRowScreen.tsx — sub-components must not use the Screen suffix
// ❌ HomeScreen.tsx with export const Home — symbol must match file name
```

## Component declaration — never use React.FC
```tsx
// ✅ Correct
type HomeScreenProps = {
  navigation: TReactNavigation;
};

const HomeScreen = ({ navigation }: HomeScreenProps) => {
  // ...
};

// ❌ Wrong
const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {};
```

## React Navigation — route params and `navigation` typing

- **Route params type** lives in the **same file** as the screen (co-located). Name it `T{Name}ScreenParams` with suffix `Params` (see **Naming** in core rules: `T` for app-layer types). Example: `TCheckoutScreenParams` next to `CheckoutScreen`.
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

```tsx
// ✅ Blank line above + below the banner
const x = 1;

// -------- Effects --------

useEffect(() => {
  // …
}, []);

// -------- Callbacks --------

const handlePress = () => {};

// ❌ No blank line below / above
// -------- Effects --------
useEffect(() => {}, []);
const handlePress = () => {};
// -------- Callbacks --------
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
- No commented-out dead code — delete it

## Pressable vs display cards
- **`DsCard`** is for **display-only** surfaces — do not add `onPress` / primary tap handling to it.
- Use a **`Pressable`** / touchable wrapper (or another explicit pressable card) when the whole card must be tappable.

## Local vs global components
- If a component is used in only one screen → place it in the screen's folder (`PascalCase.tsx`, no `Screen` suffix)
- If a component is reused across screens → move it to `components/`

## Barrel `index` files (re-exports)
- Do **not** add an `index.ts` / `index.tsx` whose **only role** is to re-export sibling modules in the same folder (barrel / `export { … } from './…'`). Import concrete files instead (e.g. `./MyFeature/MyFeatureList`).
- **Single exception:** the **repository root** entry file only (`index.js`, `index.ts`, or `index.tsx` next to `app.json` / `package.json`), e.g. Expo `registerRootComponent` — required by the bundler. Path aliases do not change this.
- **Additional project exceptions:** `components/ds/index.ts` and `components/ds/composed/index.ts` are allowed as curated public export surfaces.
- A folder may still use `index.tsx` / `index.ts` as the **main source file** of one component (real implementation, not re-exports only); that is not a barrel.
- Legacy re-export barrels (e.g. `components/ds/index.ts`, `services/auth/index.ts`) exist for historical reasons — **do not add new ones** for new features.
