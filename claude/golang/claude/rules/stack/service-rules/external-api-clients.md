---
title: External API Clients (non-DB services)
description: services external HTTP client PostJSON DefaultClient sync.Once context AttachBearer authctx logging; not pure subpackages.
globs: services/**/client.go,services/**/authctx.go,services/**/http_client.go
---

# External API Clients (non-DB services)

Some code under `services/` is not business logic backed by GORM. It is an **external API client layer** (HTTP calls to another service).

## Location and naming
- Keep external API clients under `services/<api_name>/` to match the service boundary used by controllers.
- Use underscores for folder readability when needed: `services/my_api/` (package name: `myapi`).
- Scope endpoints by resource under subfolders when the API is large:
  - `services/my_api/users/` (package `users`)
  - `services/my_api/products/` (package `products`)

## Package split
- **`services/<api_name>/` (package root)**: shared HTTP client utilities
  - `client.go` — client config (base URL, API key), singleton via `sync.Once`
  - `authctx.go` — private context key for bearer token forwarding (`AttachBearer`, `bearerFromContext`)
  - `http_client.go` — TLS custom CA, shared transport config (when needed)
  - request execution (`PostJSONWithContext`, `GetJSONWithContext`)
  - shared error decoding / logging
- **`services/<api_name>/<resource>/`**: resource-specific service + types
  - request/response DTOs owned by that external API resource
  - endpoint functions (e.g. `GetUser`, `CreateOrder`)

## Singletons
- Prefer a singleton for the shared HTTP client:
  - `DefaultClient()` implemented with `sync.Once`
- Resource services may also expose `DefaultService()` (also `sync.Once`) built from `DefaultClient()`.
- Controllers should **not** instantiate external clients directly (avoid `NewClient()` in controllers).

## HTTP client
- `NewClient()` / `DefaultClient()` must use `&http.Client{Timeout: …}` (e.g. **15s**) — never an unbounded client.
- Prefer `*WithContext` methods so cancellation and bearer forwarding work.

## Bearer forwarding (internal services only)
- Use `AttachBearer(ctx, rawToken)` in `authctx.go` with a **private** context key type.
- Only the client package can read the token back — see `security-rules/security-auto.md` for trust-boundary constraints.

## Logging
- Use `helpers.SRCLogger` inside the client/services for request/parse errors.
- Log outbound **request bodies at DEBUG only** — payloads may contain PII; never INFO log full JSON bodies.
- Controllers should log at `helpers.CTRLogger` when mapping errors to HTTP responses.

## Context
- Accept `context.Context` on endpoint methods and pass it through `http.NewRequestWithContext`.
  - Example signature: `func (s *Service) GetUser(ctx context.Context, userID int64) (*User, error)`
