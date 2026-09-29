---
description: Routes, DTOs and requests are consumed by the React Native app — its api:map / api:dto reports and its stack audit show the screens impacted and the drift.
paths:
  - "controllers/**"
  - "router/**"
---

# Front contract — the app reads these shapes

When the React Native app of the stack sits next to this backend (`../<app>` for `<app>-back`), its stack
tooling reads this repo's code and generates:

- `../<app>/docs/api/api-map.md` (`npm run api:map` in the app): each route → the front function calling it →
  every screen reaching it, however deep. Read it before changing or removing a route to know which screens
  are impacted, and to spot routes the app never calls.
- `../<app>/docs/api/dto-check.md` (`npm run api:dto`): each `*Dto` / `*Request` struct checked against the
  app's types (missing fields, nullability, `omitempty`, `binding:"required"`, query params), plus the fields
  the app never reads — candidates to drop from a DTO. The app's stack audit runs the same comparison
  (`F-API-*`).

The user runs these commands: never run them yourself or wire them into a hook or CI. After changing a DTO, a
request or a route, point out that `npm run api:dto` (and `api:map` for routes) should be re-run in the app,
and read the existing reports if they help.

The tooling parses this repo without compiling it. Keep these shapes, or the route shows up as "not
resolved" in the reports:

- one route per line in `router/router.go`, on a group variable (`sessions.GET("/:id", …, ctl.GetOne)`);
- a request bound as `var req X` + `helpers.ShouldBindJSON(c, &req)`;
- a success response written as `c.JSON(http.StatusOK|Created, ToXDto(...))`, the mapper declaring its return
  type (`func ToXDto(...) XDto`), or `c.Status(http.StatusNoContent)`;
- JSON names only through `json:"…"` tags.
