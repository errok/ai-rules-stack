---
description: Table naming taxonomy — type, instance, composition, M-N, status, history
paths:
  - "database/model/**/*.go"
  - "database/tables/**/*.sql"
  - "database/init.sql"
---

# Database — table naming

One sentence: **`_type` = lookup · `_instance` = typed occurrence · `parent_child` = composition · `a_b` = M-N · status as text while trivial.**

Use **singular** table names (`user`, `order`, not `users`).

## Suffixes

| Pattern | Role | Typical PK | Examples |
|---|---|---|---|
| `*_type` | Shared lookup / catalogue | `integer` | `order_type`, `payment_type`, `document_type`, `color_type` |
| `*_instance` | Occurrence of a type | `uuid` | `ticket_instance` (pair with `ticket_type`); often the entity stays bare (`order` + `order_type`) |
| bare entity | Aggregate / pivot / resource | `uuid` | `user`, `account`, `organization` |
| `parent_child` | Strong 1-N composition | `uuid` | `order_line`, `invoice_item`, `building_floor` |
| `a_b` | Pure M-N association | `uuid` or composite | `user_role`, `post_tag`, `account_team` |
| `*_status` / `status_type` | Status catalogue | `integer` | only if labels / i18n / transitions / reuse; else column on the entity |
| `*_history` / `*_event` / `*_log` | Audit / timeline | `uuid` or `bigserial` | `order_history`, `audit_log`, `login_event` |
| `*_snapshot` | Frozen copy | `uuid` | `price_snapshot`, `address_snapshot` (or a denormalized FK column on the parent row) |
| `*_config` / `*_setting` | Preferences | `uuid` | `tenant_config`, `user_setting`, `notification_setting` |

## Rules

- Shared catalogue → always `*_type` (never a bare name like `color`; use `color_type`).
- Explicit typed occurrence → `foo_type` + `foo_instance` when the pair must be obvious; otherwise bare entity + `foo_type` is enough.
- Strong child of a parent → `parent_child`, not `_instance` and not `_rel`.
- Pure M-N → `a_b` (dominant-first or alphabetical); do not fake it as a child table.
- Trivial status (`active` / `archived`) → `text` column (+ check). Introduce `*_status` / `status_type` only when the catalogue earns its keep.
- Encrypted / non-SQL refs (`*_ref`) are not relational suffixes and must not get GORM FK associations.
- Prefer encoding domain facts as FKs (`size_type_id`) over stuffing them into free-text names (`XL-blue`).

## Anti-patterns

- Bare catalogue name (`color`) instead of `color_type`
- Bare preference table (`setting`) instead of `user_setting` / `*_setting`
- Using an M-N join when the real concept is a physical child (`building_floor`)
- One `*_status` table per entity without a product need
- Encoding typed facts only in string labels
