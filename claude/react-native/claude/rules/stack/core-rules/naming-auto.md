---
description: Naming T E Dto PascalCaseScreen screens no Screen suffix on components filename matches export ScreenProps Params use{Name}Store hooks; legacy I* migrate; API …Dto vs domain T… (always on).
---

# Naming — canonical

| Pattern | Convention | Example |
|---|---|---|
| Generic app / domain type | Prefix `T` | `TCard`, `TUserProfile`, `TAuthStore` |
| Enum | Prefix `E` | `ECardSize`, `EAuthStatus`, `EHomeRoutes` |
| API payload (HTTP request or response) | Suffix `Dto` | `MeDto`, `HelloResponseDto` |
| Screen file + component (nav entry point) | `PascalCase` + suffix `Screen` — file and export match | `HomeScreen.tsx` → `HomeScreen` |
| Reusable / local screen component | `PascalCase` — **no** `Screen` suffix — file and export match | `SettingsRow.tsx` → `SettingsRow` |
| Screen props type | Suffix `ScreenProps` | `HomeScreenProps` |
| Other component props type | Suffix `Props` | `ButtonProps`, `SettingsRowProps` |
| Screen route params (React Navigation) | Suffix `Params` | `TCheckoutScreenParams` |
| Custom hook | `use{Name}` | `useProgress`, `useAppConfig` |
| Zustand store | Hook `use{Name}Store`, state type `T{Name}Store` | `useUserStore`, `TUserStore` |

- **File name = exported symbol** (without extension), for screens and components alike. Only navigation entry-point screens use the `Screen` suffix — never sub-components, even under `screens/`.
- **`…Dto` vs `T…`:** `…Dto` mirrors an HTTP payload — keep the suffix, never rename `MeDto` → `TMe`. `T…` is any app-layer type (UI model, store state, mapped view model).
- **Legacy `I*` types:** never add one. When you meet or edit one, tell the user and suggest the new name (`T…`, or `…Dto` for an API shape); offer the rename when the scope is small.
