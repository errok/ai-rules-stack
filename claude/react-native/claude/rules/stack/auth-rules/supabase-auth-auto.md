---
description: Supabase services/auth — authService barrel only, MMKV session storage, autoRefreshToken, onAuthStateChange; not supabaseAuthService direct import.
paths:
  - "services/auth/**"
---

# Auth — Supabase provider (`services/auth`)

## Provider selection
- `AUTH_PROVIDER` env var (default: `supabase`). Add new providers in the `services/auth/index.ts` switch — concrete providers (`providers/supabaseAuth`, …) are never imported outside `services/auth/`.

## Session storage
- Supabase session is persisted via **MMKV** (encrypted) in `services/auth/providers/supabaseAuth.ts` — not in Zustand.
- Keep `autoRefreshToken: true` and `persistSession: true` on the Supabase client unless there is an explicit product/security decision.

## Token access for HTTP
- `authService.getIdToken()` returns the Supabase access token (used by `utils/fetch.ts` helper `r`).
- `authService.refreshToken()` delegates to `refreshSession()` and returns the new access token — used for 401 retry in `r`.

## Auth state listener
- `onAuthStateChange` is the source of truth for login/logout transitions at app shell level.
- Screens must not duplicate session polling when the listener already drives navigation state.

## Sign-out
- Centralize logout orchestration in the app shell: `authService.signOut()` then `clearAllStores()` from `stores/utils/clearStores.ts`.
- Child screens call `onLogout()` from props — do not call `signOut()` again if the parent already handles it.
