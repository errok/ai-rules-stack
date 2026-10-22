---
description: Always-on, every project — each Postgres table lives in a named schema, never in public.
---

# Database — every table in a named schema

- **Every table lives in a named schema — never in `public`.** Pick the schema by responsibility (`identity`, `club`, `session`, `i18n`…) when the table is created: `public` stays empty, so the separation is forced from the first table.
- The schema is part of the table's name wherever it is written: `<schema>.<table>` in the DDL, in the model and in any reference.
- Keep dependencies between schemas **one-way**: a foreign key from schema A to schema B means B never points back to A.
- Moving a table between schemas never copies data: `ALTER TABLE … SET SCHEMA …` (indexes, constraints, foreign keys, sequences, triggers and RLS follow; grants and the body of functions do not — check them).
- A backend applies this through its own rules (Go: `database-rules/`); an app or any other project that owns SQL follows the principle as is.
