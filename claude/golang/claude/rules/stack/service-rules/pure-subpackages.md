---
title: Pure domain subpackages
description: Stateless pure functions under services/domain/subpackage; no GORM no HTTP; external API clients use external-api-clients rule.
paths:
  - "services/*/*/**/*.go"
---

# Pure Domain Subpackages

Complex calculations and policy predicates that should not live in controllers or in fat service methods belong in **small subpackages** under the same domain as the parent service.

## Placement
- Path pattern: `services/<domain>/<pure_name>/`
  - Examples: `services/order/pricing`, `services/order/eligibility`
- Package name: idiomatic Go (no underscores), e.g. `pricing`, `eligibility`

## Rules
- **No database access** (no `database.GetDB()`, no GORM).
- **No HTTP clients** or external I/O.
- **No imports of other level-1 services** under `services/<other>/` (except types from the same domain parent if needed).
- Prefer **pure functions** operating on primitive or small input structs defined in the same subpackage (often `*_domain.go`).

## When to use
- Formulas (points, duration, bonus rules aggregation).
- Time-window or eligibility checks used by the application layer after data was loaded by services.

Orchestration (load entity, load config, then call pure function, then persist) stays in `application/<object>/` or in thin service methods that only do I/O.
