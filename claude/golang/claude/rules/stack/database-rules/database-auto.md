---
description: GORM table mirrors database/model database/db.go Init connection RunInTx FromContext transaction in context; entity files GORM tags no JSON; init.sql for schema bootstrap.
globs: database/db.go,database/model/**/*.go
---

# Database — Models & Connection

## DB models (`database/model/`)
- Mirror of DB tables — one file per entity (`user.go`, `order.go`)
- **PostgreSQL schema `public` (default)** — models live at the **root** of `database/model/`; `TableName()` is the bare table name (e.g. `"users"`).
- **Any other schema** — one subfolder per schema name under `database/model/<schema>/`:
  - Example: tables in schema **`i18n`** → `database/model/i18n/notification_type.go`
  - Go package name = folder name: `package i18n` (import `…/database/model/i18n`)
  - `TableName()` must stay **schema-qualified**: `"i18n.notification_type"`, etc.
- GORM tags only — never JSON annotations (models are not returned to the client as API contracts)
- FK associations: each `XxxID` has a matching relation field — see `gorm-model-associations.md`
- Naming: structs `PascalCase`, fields `PascalCase`, tables/columns `snake_case`
- Use `time.Time` for dates

```go
// ✅ catalogue
type SessionType struct {
  ID   int    `gorm:"type:int;primaryKey;autoIncrement"`
  Code string `gorm:"type:text;not null"`
}

// ✅ entity (uuid) — see also table-naming for *_instance
type Member struct {
  ID     uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
  Handle string    `gorm:"type:text;not null"`
}
```

## Connection (`database/db.go`)
- Singleton `*gorm.DB` accessed via `database.GetDB()` (or package-level export during migration)
- Config loaded from env vars via `config/`
- `PreferSimpleProtocol: true` on the postgres driver config
- Log DB connection failures via `helpers.DBLogger`
- Graceful shutdown: call `database.CloseDatabase()` from a `main.go` defer
- The transaction travels in the context — `db.go` is the only place that knows how:
  - `RunInTx(ctx, fn func(ctx context.Context) error)` opens one (a savepoint when `ctx` already carries one) and calls `fn` with a `ctx` that carries it; commit on `nil`, rollback on an error or a panic.
  - `FromContext(ctx, db)` returns the transaction carried by `ctx`, else `db`, bound to `ctx`.

## Queries
- Do **not** chain `.Debug()` on GORM builders in services
- SQL trace is enabled when the **DB** log perimeter is `DEBUG` (`LOG_DB_LEVEL` or `LOG_LEVEL`); see `LOGGING.md`
- Set appropriate timeouts on DB operations where relevant

## Schema bootstrap
- Initial schema via `database/init.sql` (idempotent SQL script)
- No AutoMigrate in production — migrations are managed explicitly

## Naming
- Tables: singular `snake_case` (`user`, `order_line`) — taxonomy in `table-naming.md`
- Columns: `snake_case` (`created_at`, `user_id`)
- Structs: `PascalCase`
- Fields: `PascalCase` (`ID`, `CreatedAt`, `UserID`)
