---
description: gin handlers DTO mapper HTTP router registration /api/v1 public nested resources sealed controller roots errors.Is sentinels HTTP 400 401 404 controllers/v1.
paths:
  - "controllers/**/*.go"
  - "router/**/*.go"
---

# API — Controllers & Router

## Controller layout
- Versioned API handlers: `controllers/v1/<resource>/` with `*_dto.go`, `*_request.go` (when inputs exist), `*_mapper.go`, `<resource>.go`
- Cross-cutting controllers: `controllers/health/`, `controllers/common/`
- **Nested resources (URL owns the tree):** a route under `/parent/:id/child` lives in the **parent** controller package as a subfolder with the same file pattern — e.g. `GET /orders/:id/lines` → `controllers/v1/order/line/` (not `controllers/v1/line/` alone). Do **not** register nested parent URL handlers on the child's top-level controller just because the child owns the domain table.
- **Controller roots are sealed** (same rule as level-1 services): each package directly under `controllers/v1/` is a controller root.
  - A root **never** imports another root — no sibling DTO, request, mapper or handler (`controllers/v1/order/line` must not import `controllers/v1/product`).
  - **Inside** one root, subpackages may import the root and each other (`controllers/v1/order/line` may use `controllers/v1/order`).
  - `controllers/common/` is the only package every controller may import.
  - Two roots returning the same wire shape each keep their own `*_dto.go` + `*_mapper.go` (same struct names and `json` tags) instead of sharing one.

| File | Role |
|---|---|
| `[name]_dto.go` | Response models — JSON tags, suffix `Dto`, **no methods** (data fields only) |
| `[name]_request.go` | Input models — JSON + validation tags, **no methods** (data fields only) |
| `[name]_mapper.go` | Mapping: domain → Dto (`ToDto()`, etc.) |
| `[name].go` | Gin handlers — HTTP only, no business logic |

## DTOs and requests (`*_dto.go`, `*_request.go`) — data only
- **Never** add methods on Dto or request structs (no `func (d SomeDto) …`).
- Formatting, defaults, and derived fields belong in **`*_mapper.go`** or handler helpers — as plain functions (e.g. `ToUserDto(domain *user.UserDomain) UserDto`).
- Response/request struct names (`FooDto`, nested `BarDto`) and `json` tags are the **canonical wire contract** — keep them stable and document breaking changes.

## Strict separation
- DTOs: JSON only, no GORM tags, not mixed with request structs
- Requests: validation tags where applicable
- Controllers: bind → validate → call **one** orchestrator (or one service for a single-service flow) → **map via mapper** → HTTP status
- A handler never sequences 2+ services (or a service plus an external client) — that flow belongs in `application/<object>`. No business rules or algorithms in handlers.
- **No DTO construction in controllers**: controllers must not build DTO slices/structs inline; always delegate to `*_mapper.go`

## Mappers (`*_mapper.go`) — service import + domain alias
- Import the level-1 service package with alias **`srv{Resource}`** in camelCase (e.g. `srvUser`, `srvNotification`).
- Re-export service domain types locally in the mapper file: `type FooDomain = srvUser.FooDomain`.
- Mapper function signatures use the **local domain alias**, not the qualified service type.
- In `[name].go`, reuse the **same** import alias for the controller's dependency fields (see **Controller dependencies — composition root**).

```go
// *_mapper.go
import srvUser "github.com/daystram/go-gin-gorm-boilerplate/services/user"

type UserDomain = srvUser.UserDomain

func ToUserDto(domain UserDomain) UserDto { ... }
```

- Do **not** use lowercase-only aliases (`srvuser`) or `{resource}Service` as the **package** import alias.

## Routes
- Current API group: **`/api/v1`** (see `router/router.go`)
- Register routes in `router/router.go`; keep groups readable (public vs protected)
- **Public (no JWT)** — typical pattern:
  - **Root probes:** `GET /ping`, `GET /version` (via `controllers/health/`)
  - **Unauthenticated v1 reads:** `router.Group("/api/v1")` without auth middleware, or a dedicated `/api/v1/public` group for data reachable before login
- **Authenticated app API:** `router.Group("/api/v1")` with `AuthCheck`, `EnsureUserExists` (and optional `LanguageMiddleware`)
- Gzip + `BodySizeLimit` + `LoggerMiddleware` apply globally; protected `/api/v1` stack is documented in `security-rules/security-auto.md`

### Route groups (mandatory)
- **One** `v1route.Group("/resource")` **per top-level resource** (same pattern as `/me`).
- Sort those groups **alphabetically** by path (`/me` → `/orders` → `/products` → …).
- Register nested segments on the group as relative paths: `""`, `/:id`, `/:id/child`.
- URL-nested children stay on the **parent** group and are handled by the **parent** controller tree (see nested resources above).

## HTTP responses
- Success: return DTO / payload as defined by the handler
- Use `helpers.AbortWithError`, `helpers.ResponseJSON`, or `helpers.ShouldBindJSON` for consistent error shapes (error envelope lives in `commons/helpers`, not a top-level `datatransfers/` package)
- Map errors to status codes with `errors.Is` on the sentinels the orchestrator or service exports (`errors.Is(err, appOrder.ErrOrderNotFound)` → 404) — never `err == …`, never a `gorm` error
- Validate all external input before business logic (`helpers.ShouldBindJSON` gives field-level errors)
- Errors: appropriate HTTP codes with clear messages
  - **400** — validation / bad input; field-level messages when safe for the client
  - **401** — missing or invalid JWT
  - **403** — forbidden (if used)
  - **404** — not found
  - **500** — internal error: log with `CTRLogger`, return a generic message — **never** `err.Error()`, an upstream API `detail` or a stack trace

## Context helpers
- Use `controllers/common/GetUserContextOrAbort(c, caller)` to extract authenticated user context — do not re-parse JWT in handlers
