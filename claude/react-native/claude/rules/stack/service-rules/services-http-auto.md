---
description: HTTP r rPublic shared fetch helper no raw fetch Dto types errors bubble to screens hooks stores auth barrel.
paths:
  - "services/**"
---

# Services — HTTP Layer Conventions

## HTTP client
- `r` adds the auth header, platform info, a 45s timeout, caller cancellation via `AbortSignal` and one retry after 401 — never re-implement any of it in a service.

## Error handling
- **No try/catch in `services/**`**: let errors from `r()` bubble up.
- Error shaping / user-facing messages must be handled **higher in the stack** (hooks, screens, stores).
- Services stay as thin transport functions (url/method/params/typing).
- In screens, read HTTP error codes via `getApiErrorCode()` from `utils/apiError.ts` (`r` throws `{ code, message }`).

```tsx
// ✅
const getUserMe = async (): Promise<MeDto> => {
  return await r<MeDto>({ url: '/api/v1/me', method: 'GET' });
};

// ❌
const getUserMe = async (): Promise<MeDto> => {
  try {
    return await r<MeDto>({ url: '/api/v1/me', method: 'GET' });
  } catch {
    throw new Error('User-friendly message');
  }
};
```

## Typing
- No runtime validation (no Zod) — TypeScript types only for API responses
- Define DTOs in the service file or a co-located `*Types.ts` file

## DTO names — align with backend contracts
- Mirror the **exact type names** and JSON field names from the target backend API.
- Optional fields: reflect backend `omitempty` / optional semantics with `?` in TypeScript.
- **Backend is source of truth** for wire contracts; update front service types when API DTOs change.
- No ad-hoc front-only aliases for HTTP payloads.

## Endpoints
- Prefer a stable `baseEndPoint` per domain and append the path in each function.
- Paths are relative to `API_URL` (e.g. `/api/v1/me`) unless a full URL is required.

```ts
// ✅
const baseEndPoint = '/api/v1/me';
export const getMe = async (): Promise<MeDto> => {
  return await r<MeDto>({ url: baseEndPoint, method: 'GET' });
};
```

## File naming
- `camelCase.ts` or domain folder (`api/me.ts`, `auth/index.ts`)
