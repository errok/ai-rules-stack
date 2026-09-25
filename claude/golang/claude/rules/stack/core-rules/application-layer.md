---
description: application orchestration New() no gin; controllers must not wire 2+ level-1 services per handler—use application/<object>; multi-service flows.
globs: application/**/*.go,controllers/**/*.go
---
# Application Layer (Orchestration)

The `application/` tree hosts **transport-agnostic orchestration** for a primary object that may depend on multiple level-1 services.

## Folder and file naming
- Use object-scoped packages:
  - `application/<object>/`
    - `<object>.go` (orchestrator / usecases)
    - `<object>_mapper.go` (input assembly / mapping helpers)
- Folder names may use underscores for readability, but package names should remain idiomatic Go (no underscores).

## Responsibilities
- `application/<object>` may:
  - call multiple **level-1** services under `services/*`
  - call pure computation packages under the same object domain (e.g. `services/<domain>/<pure_subpackage>/`)
  - compose results into a single outcome for controllers/other entrypoints
- `application/<object>` must **not**:
  - import or depend on `gin`
  - use `database/model` **for entity/table structs** or persistence (DB access belongs to services)
- **Config keys:** If orchestration needs a config key string, prefer encapsulating the key inside a dedicated service (e.g. `services/appconfig`).

## Cross-service flows
- Load entities via level-1 services (`GetByID`, etc.); avoid ultra-specific getters when a normal fetch by id is enough.
- Read configuration via a config service, not raw DB queries in the application package.
- Apply **pure** rules from `services/<domain>/<pure_subpackage>/`.
- Persist mutations via focused service methods.
- **Product defaults:** If a required config is missing, define explicit behavior instead of failing with a generic DB error unless product requires otherwise.

## Instantiation
- Prefer explicit construction:
  - call `New()` from a controller constructor, built once in the composition root (see **Controller dependencies — composition root**)
- Avoid singletons (`Default()`) in the application layer unless there is real shared state/cost.
  - Singletons are acceptable for external API clients when sharing an `http.Client` or caches.

## Controller guidance (HTTP layer)
- **Do not** wire **multiple level-1 `services/*` dependencies** (or service + external client orchestration) **inside a single handler** — the agent must not add several service fields to the controller just to sequence calls for one endpoint. That logic belongs in `application/<object>`; the controller calls **one** orchestrator (or one service when the flow is truly single-service).
- Controllers should:
  - validate/bind requests
  - call `application/<object>` orchestrators for non-trivial flows
  - map errors to HTTP responses
- Rule of thumb: if a controller endpoint needs to call **2+ services** (or a service plus an external client), create an `application/<object>` orchestrator and call that instead of wiring multiple dependencies in the controller.
- Controllers should avoid embedding non-trivial business rules or algorithms (extract to pure packages under the relevant domain).

## Related
- **Service boundaries** (no cross-imports between level-1 `services/*` packages) and **service layer structure** live in the **Services — business logic** rule under `service-rules/`.
