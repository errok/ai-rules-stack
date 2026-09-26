---
description: GORM services domain mapper Service struct; level-1 services must not import each other (orchestrate in application); database.FromContext ctx transaction; gorm.ErrRecordNotFound translated into Err*NotFound sentinels; external API clients see external-api-clients.
paths:
  - "services/**/*.go"
---

# Services — Business Logic Layer

## Service boundaries (dependency graph)
This codebase enforces **strict service boundaries** to keep the dependency graph simple and microservice-friendly.

### Level-1 services (no cross-calls)
- A **level-1 service** is a package directly under `services/<name>/...`.
- Level-1 services must **not** call each other.
  - Example (NOT allowed): `services/order` importing `services/notification`

### Intra-domain subpackages (allowed)
- Subpackages within a single domain may call their domain parent:
  - Example (allowed): `services/order/pricing` importing `services/order/discounts`
- **Pure subpackages** (`services/<domain>/<pure>/`) have no DB and no cross–level-1 calls; see `pure-subpackages.md`.

### Where orchestration belongs
- Multi-service orchestration belongs to:
  - `application/<object>/` packages
  - or controllers for trivial passthrough endpoints

## Service file structure
Each service lives in `services/<name>/` (nested domains use subfolders) with these mandatory files:

| File | Role |
|---|---|
| `[name]_domain.go` | Business models and error sentinels — no JSON, no GORM tags, **no methods** (data fields only; see below) |
| `[name]_mapper.go` | `ToDomain()` (model→domain), `ToModel()` (domain→model), `NewDomain()` |
| `[name].go` | Business logic + GORM queries via `*gorm.DB` |

## Nested subpackages (same domain)
- When adding a focused feature inside a domain, create a **dedicated subpackage** instead of dumping extra files in the parent package.
- The subpackage must follow the same structure: `*_domain.go` + `*_mapper.go` + `*.go` (service/query).
- Keep GORM rows/joins mapping in the subpackage mapper (no inline row→domain mapping in the service).
- **Services should load full domain**: do not shape DB `SELECT` clauses to match a specific controller DTO. Load `table.*` (plus optional enriched/join fields) so the same service method can be reused by other controllers; controllers decide the projection.
- **Prefer high-level GORM APIs**: use `Model(&T{})`, `Where`, `Preload`, relations, and typed structs.
  - Avoid `Table(...)`, raw `Select(...)`, and hand-written `Joins(...)` unless there is no other reasonable way (perf, complex aggregation).
  - If ordering/filtering needs data from a preloaded relation and would force a custom join, prefer sorting/filtering **in Go** for simple lists.
- **Mapper owns domain list assembly**: when converting DB models to **domain slices** (`[]Domain`) and applying domain-level ordering, put the loop + sorting into `*_mapper.go` (e.g. `toDomainList(...)`). Services should just fetch models and call the mapper.

## Domain types (`*_domain.go`) — data only
- **Never** add methods on domain structs (no `func (d SomeDomain) …`).
- Parsing, validation, derived values, and mapping belong in **`*_mapper.go`**, the service `*.go`, or a **pure subpackage** — as plain functions.
- Exception: this rule targets **service domain** types, not `database/model` GORM mirrors (`TableName()`, relations tags, etc.).
- Same **data-only** rule for controller **`Dto`** / **request** structs — see **API — Controllers & Router** under `api-rules/`.

## Patterns
- Service struct holds `*gorm.DB` directly — no repository interface
- All business logic stays in the service, not the controller
- Prefer intermediate assignment over chaining for readability and debugging:

```go
// ✅
query := db.Where(...).Where(...)
if err := query.First(&model).Error; err != nil { ... }

// ❌
if err := db.Where(...).Where(...).First(&model).Error; err != nil { ... }
```

- Prefer GORM `Preload`/`Joins` over manual joins when relations are declared on models

## Ownership scoping and SQL safety
- For user- or tenant-scoped data, every read/write constrains rows to the current user/tenant from context (`Where("user_id = ?", userID)`) — never trust an ID from the client alone. Catalogue / public tables have no owner key but still need the right checks (auth, role, flags). Assume data is scoped unless it is confirmed public.
- No string concatenation for SQL values — parameterized GORM queries only (`Where("id = ?", id)`).

## Queries — context and transaction
- Start every query from **`database.FromContext(ctx, s.db)`**: it returns the caller's transaction when `ctx` carries one, else `s.db` bound to `ctx`. Never a bare `s.db` or `s.db.WithContext(ctx)`, and no `WithTx(tx)` constructor.
- The service never decides whether it runs in a transaction: the orchestrator opens it and hands the `ctx` down (see **Transactions** in the application layer rule).
- A multi-statement write inside one service opens `database.FromContext(ctx, s.db).Transaction(func(tx *gorm.DB) error { … })`; inside a caller's transaction it becomes a savepoint.

## Errors — translate GORM into sentinels
A service never lets a `gorm` error describe an expected outcome: it returns an explicit sentinel declared in `[name]_domain.go`, which `application/` and controllers match with `errors.Is` to answer the front properly.

| Outcome | Return |
|---|---|
| `gorm.ErrRecordNotFound` | `Err{Entity}NotFound` |
| Targeted `Update` / `Delete` with `RowsAffected == 0` | `Err{Entity}NotFound` |
| Business refusal (duplicate, invalid input) | its own sentinel (`ErrUserAlreadyExists`, `ErrInvalidQuantity`) |
| Any other DB error | log it with `SRCLogger`, return it unchanged (the caller answers 500) |

```go
// user_domain.go
var (
	ErrUserAlreadyExists = errors.New("user already exists")
	ErrUserNotFound      = errors.New("user not found")
)

// user.go
if err := query.First(&row).Error; err != nil {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrUserNotFound
	}
	helpers.SRCLogger.Error("UserService.GetOneByAuthID: %v", err)
	return nil, err
}
```
