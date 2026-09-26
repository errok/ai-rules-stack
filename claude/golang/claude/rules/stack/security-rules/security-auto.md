---
description: JWT bearer middleware AuthCheck EnsureUserExists Supabase infrastructure auth; BodySizeLimit gzip Recovery; pluggable IdP registry.
paths:
  - "middleware/**/*.go"
  - "infrastructure/**/*.go"
  - "router/router.go"
  - "main.go"
  - "services/**/authctx.go"
---

# Security & Middleware

## Authentication
- **Bearer JWT** validated in middleware; **provider-specific** code stays under `infrastructure/auth` and is **swappable** (Supabase default, OIDC/JWT IdP, custom issuer, etc.).
- **Default provider:** Supabase — JWKS ES256 validation, claims normalized to `infrastructure/auth.Claims`.
- **No ad-hoc JWT parsing in handlers** — reuse middleware + `infrastructure/auth` + registry.

## Middleware stays thin (no business monolith)
Middleware is **transport / cross-cutting only**: auth, body limits, gzip, recovery, access logs, request-context enrichment (identity, locale).
- **Allowed:** validate JWT, attach claims / user context, reject oversized bodies, log the request.
- **Forbidden in middleware:** product use cases, multi-service orchestration, domain validation beyond “is this identity usable”, feature workflows.
- If a change needs domain rules or several services → put it in `services/` or `application/`, call it from a controller — do **not** grow `middleware/` into a second app layer.
- Lightweight identity lookup to enrich context (e.g. `EnsureUserExists`) is fine; keep it small and stable.

## Protected API stack (see `router/router.go`)
Typical order on the **`/api/v1`** group:
1. `middleware.AuthCheck()` — JWT validation via `infrastructure/auth/registry`
2. `middleware.EnsureUserExists()` — ensure user record in DB; enriches request context (`UserContext`)
3. `middleware.LanguageMiddleware()` — language / i18n context (optional, when `I18N_ENABLED`)

Global stack (before groups) includes:
- `gin.New()` (not `gin.Default()`)
- `router.SetTrustedProxies(nil)`
- **`middleware.ErrorLoggerMiddleware()`** (structured panic recovery)
- **`middleware.BodySizeLimit`** (1 MiB request bodies)
- `gzip.Gzip(gzip.DefaultCompression)`
- `middleware.LoggerMiddleware()`

## HTTP server hardening (`main.go`)
- Start the API with an explicit `http.Server` — do **not** use bare `r.Run()` without timeouts.
- Recommended defaults:
  - `ReadHeaderTimeout: 5s` (anti-Slowloris)
  - `ReadTimeout: 15s`
  - `WriteTimeout: 30s`
  - `IdleTimeout: 60s`
- Outbound `http.Client` instances (Supabase JWKS, external API clients, etc.) must set a **non-zero `Timeout`** (e.g. 15s) — never `http.DefaultClient` or `&http.Client{}` without one.

## Supabase token validation (infrastructure)
- Validate signature via JWKS fetched from `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`
- Cache JWKS in-memory with periodic refresh (`infrastructure/auth/provider/jwks_cache.go`)
- Verify `iss`, `exp`, and audience as required by Supabase
- `extractBearerToken` must require the **`Bearer`** scheme (`strings.EqualFold` on the scheme part)

## Internal API — forwarding the end-user JWT (optional pattern)
- After successful JWT validation, `middleware.AuthCheck()` may attach the **raw bearer string** to `c.Request.Context()` via a private context key in the outbound client package (e.g. `AttachBearer` in `services/<api>/authctx.go`).
- The context key must be **private to the client package** so random packages cannot read the token from `context.Context`.
- **Scope:** use this pattern **only** for outbound calls to **internal services** (same trust boundary / private network). Do **not** reuse it to send user JWTs to external SaaS or untrusted third parties; prefer service credentials, token exchange, or audience-restricted tokens instead.

## Context
- User data is read from gin context set by middleware — use `controllers/common/` helpers and `middleware/context.go` instead of duplicating claims parsing in controllers

## Error responses
- Middleware aborts follow the HTTP responses of the **API — Controllers & Router** rule: generic message on a 500, never `err.Error()`.
