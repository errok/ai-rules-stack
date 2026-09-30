---
description: Front ↔ Go back contract — npm run api:map (screens → back routes) and npm run api:dto (DTO / request drift, unused fields), from the ai-rules-stack audit tooling.
paths:
  - "services/**"
  - "hooks/**"
  - "stores/**"
  - "screens/**/hooks/**"
  - "tmp/api/**"
---

# Front ↔ back contract — API map and DTO check

When the app's Go back (golang stack) sits next to it as `../<app>-back` (or at `AUDIT_BACK_DIR`), the stack
tooling in `sub-modules/ai-rules-stack/audit/react-native/` generates two reports:

- `tmp/api/api-map.md` (`npm run api:map`): for each screen, every back route it reaches, **directly or
  through any depth** of components, hooks, stores and helpers, with the longest / shortest chain, depth and
  path count; the reverse view (route → front function → screens, and entry points outside screens such as
  `App` boot); the gaps (front calls without a route, routes never called, API functions no screen reaches).
- `tmp/api/dto-check.md` (`npm run api:dto`): the types given to `r<…>` / sent as `data` checked against the
  Go structs the handler binds and returns (`json` tags, pointer = nullable, `omitempty`,
  `binding:"required"`), GET query keys against `c.Query`, then **field usage**: fields the back sends that the
  app never declares, never reads, or only writes. The same comparison runs in the stack audit (`F-API-*`).

The app's `package.json` points the scripts at the submodule:
`"api:map": "node sub-modules/ai-rules-stack/audit/react-native/api-map.mjs"`, same for `dto-check.mjs`.

## How to use them

- **The user runs the commands.** Do not run them on your own and do not wire them into a hook, a
  pre-commit or CI. When a report is missing or older than the code in question (its header gives both
  commits and whether the tree was dirty), say so and suggest the command.
- Read them before touching an endpoint, a DTO, `services/api/*` or a data hook: the map shows every screen
  impacted, the check shows the current drift. Answer "who calls X / what does screen Y load" from
  `api-map.md` first, then confirm in the code.
- Never edit the reports by hand; improve the tooling in ai-rules-stack instead.
- A "never used" field is a lead, not a proof: the language service follows references and structural
  flows (a DTO passed where another type is expected), not spreads into another type or string-keyed access.
  Check before asking the back to drop a field.

## What the tooling relies on

- Front: HTTP only through `r` / `rPublic` (`utils/fetch.ts`), with a literal or `const`-built `url`, the
  response type as the type argument (`r<SessionDto>`) and the body in `data`.
- Back: the golang stack's shapes — routes one per line in `router/router.go`, `var req X` +
  `ShouldBindJSON(c, &req)`, `c.JSON(http.StatusOK|Created, ToXDto(...))` with a mapper declaring its return
  type. Code that bypasses these shapes shows up as "not resolved" in the reports.
