---
description: Expo RN stack folders auth HTTP fetch helper design-system status bar global map always on — no src/ prefix in this repo.
---

# Project — Architecture reference

**This repo:** application code lives at the **repository root** (no `src/` prefix).

## Stack
- Expo (managed workflow) + React Native
- TypeScript — strict mode
- NativeWind (Tailwind classes) for styling
- React Navigation (stacks + bottom tabs)
- Zustand for global state + MMKV for persistence
- Native fetch via `utils/fetch.ts` (helpers `r` / `rPublic`) — no axios, no TanStack Query
- Biome for linting + formatting (replaces ESLint + Prettier)
- No test suite currently

## Project structure

```
App.tsx            # Bootstrap + NavigationContainer + RootNavigator
navigation/        # RootNavigator + public/ + private/ (stacks + bottom tab menu)
  public/          # PublicStack + public.types.ts
  private/         # {section}/HomeStack + home.types.ts, BottomTabNavigator (menu only)
screens/           # Screens grouped by domain (PascalCaseScreen.tsx entry files)
components/        # Reusable UI — ds primitives + ds/composed
  ds/              # Design-system primitives (DsButton, DsText, …)
  ds/composed/     # Composed DS (DsModal, DsIconButton, …)
  menu/            # Floating tab bar overlay (when used)
services/          # HTTP layer + auth abstraction
stores/            # Zustand stores + MMKV adapter
hooks/             # Custom hooks (data, UI logic, heavy processing)
theme/             # Visual tokens / navigation theme helpers
types/             # Cross-cutting TS types
utils/             # Utility functions
config/            # Environment, Supabase, Figma
i18n/              # Localization
assets/            # Static resources
design-tokens/     # Token modules: primitives → semantic → component (mirrors components/ds/)
tailwind/          # Tailwind-only helpers (blocklist, plugins)
```

## Data flow
Expo entry → `App.tsx` → navigators → screens → components + hooks → services ↔ stores
theme / types / utils: transversal

## Layers
- **Stores** (`stores/`): shared state + synchronous setters only — never services or fetch.
- **Hooks** (`hooks/`): orchestration — call services, then update stores via setters.
- **HTTP**: authenticated calls through `r`, public ones through `rPublic` (`utils/fetch.ts`) — never raw `fetch()`.
- **Auth**: never import a concrete provider — always go through `services/auth/index.ts` (`TAuthService`).

## Design-system primitives
- Always prefer `components/ds/*` (and `components/ds/composed/*` when composed) over raw RN primitives (View, Text, TouchableOpacity…)
- Only use raw RN primitives when no DS equivalent exists
- **Product apps never fork the DS** (primitives or `ds/composed`) — see **Product apps do not override the DS** under `component-rules/`.

## Status bar
- Prefer `expo-status-bar` at the app shell; keep tab/header chrome aligned with theme tokens.

## Rule maintenance
- A new convention or decision, or the user saying "remember", "always", "never", "from now on" → propose or apply a rule update right away (see the rule-manager rule in `core-rules/`), without waiting for `/learn`.
