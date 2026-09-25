---
description: gin handlers DTO mapper HTTP router registration /api/v1 public nested resources HTTP 400 401 404 controllers/v1.
globs: controllers/**/*.go,router/**/*.go
---

# API — Controllers & Router

## Controller layout
- Versioned API handlers: `controllers/v1/<resource>/` with `*_dto.go`, `*_request.go` (when inputs exist), `*_mapper.go`, `<resource>.go`
- Cross-cutting controllers: `controllers/health/`, `controllers/common/`
- **Nested resources** use a subfolder with the same file pattern (e.g. `v1/activitytype/block/`)

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
- Controllers: bind → validate → call service → **map via mapper** → HTTP status
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

// [name].go
import srvUser "github.com/daystram/go-gin-gorm-boilerplate/services/user"

type Controller struct {
	users *srvUser.UserService
}

func NewController() *Controller {
	return &Controller{users: srvUser.NewUserService()}
}
```

- Do **not** use lowercase-only aliases (`srvuser`) or `{resource}Service` as the **package** import alias.

## Method naming (controllers)
- **List endpoints**: prefix handler methods with **`GetList`**
  - Examples: `GetList`, `GetListHistory`
- **Single-resource endpoints**: prefix handler methods with **`GetOne`**
  - Examples: `GetOne`, `GetOneByID`
- Keep naming consistent with the endpoint intent:
  - list = returns an array/collection
  - one = returns a single object (or 404)

## Routes
- Current API group: **`/api/v1`** (see `router/router.go`)
- Register routes in `router/router.go`; keep groups readable (public vs protected)
- **Public (no JWT)** — typical pattern:
  - **Root probes:** `GET /ping`, `GET /version` (via `controllers/health/`)
  - **Unauthenticated v1 reads:** `router.Group("/api/v1")` without auth middleware, or a dedicated `/api/v1/public` group for data reachable before login
- **Authenticated app API:** `router.Group("/api/v1")` with `AuthCheck`, `EnsureUserExists` (and optional `LanguageMiddleware`)
- Gzip + `BodySizeLimit` + `LoggerMiddleware` apply globally; protected `/api/v1` stack is documented in `security-rules/security-auto.md`
- Keep **route group and path names** ordered consistently with the rest of `router.go` (alphabetical groups where the file already does so)

## HTTP responses
- Success: return DTO / payload as defined by the handler
- Use `helpers.ResponseJSON` or `helpers.ShouldBindJSON` for consistent error shapes
- Errors: appropriate HTTP codes with clear messages
  - **400** — validation / bad input
  - **401** — missing or invalid JWT
  - **404** — not found
  - **500** — internal error (no stack trace to client; generic message only — see `security-rules/security-auto.md`)

## Logging
- Use `helpers.CTRLogger` in controllers — see `logging-rules/logging-auto.md`

## Context helpers
- Use `controllers/common/GetUserContextOrAbort(c, caller)` to extract authenticated user context — do not re-parse JWT in handlers
