---
description: Always-on Go backend — schema layout of the models and DDL (never public), and a table name is never written in a query.
---

# Database — schema layout and table names (Go)

The principle (every table in a named schema, never `public`) is `core-rules/database-schemas-always.md`. In a Go backend it means:

## Layout — folder, qualifier and model agree
- `database/tables/<schema>/<table>.sql` — `CREATE TABLE IF NOT EXISTS <schema>.<table>` (audit `B-DB-10`)
- `database/model/<schema>/<table>.go` — `package <schema>`, `TableName()` = `"<schema>.<table>"` (audit `B-DB-09`)
- Go packages cannot import each other: a relation that would close a loop between two schemas cannot be an association field; leave it out and say why with `// audit-ignore B-DB-01: …` on the FK column. Details: `database-rules/database-auto.md`.

## A table name is never written in a query (audit `B-DB-08`)
- The name lives in the model's `TableName()` only: no `FROM club.club_member`, no `Joins("JOIN …")`, no `Table("…")`, no `table.column` qualifier in a string.
- Build the query from the models: `Model(&model.X{})`, `Where(&model.X{Field: v})`, association joins (`Joins("Assoc")`, `InnerJoins("Assoc", db.Where(&model.Y{…}))`), subqueries (`Where("col = (?)", db.Model(&model.Y{}).Select("id").Where(&model.Y{…}))`). Columns stay unqualified.
- Only when GORM cannot build it (aliased self-join, aggregate with `FILTER`, `UPDATE … RETURNING`): `Raw` with a `?` per table and `database.TableOf(db, &model.X{})` — the name still comes from the model.
