---
description: CTRLogger SRCLogger commons/helpers; controllers services application middleware infrastructure; router uses LoggerMiddleware only.
globs: controllers/**/*.go,services/**/*.go,application/**/*.go,middleware/**/*.go,infrastructure/**/*.go
---

# Logging

Full reference: **`LOGGING.md`** at repo root (levels, scopes, `LOG_LEVEL`, `LOG_*_LEVEL`, `DISABLE_DEBUG_LOGS`).

## Loggers
- **Controllers** — use `helpers.CTRLogger` from `commons/helpers`
- **Services** — use `helpers.SRCLogger` from `commons/helpers`
- **Auth / DB / Config / HTTP** — use scoped loggers from `commons/helpers` (`AuthLogger`, `DBLogger`, `ConfigLogger`, `HTTPLogger`, etc.)
- Do **not** use `logrus` or stdlib `log` directly in new code — go through the project helpers

## What to log
- Log **errors** on all failure paths (HTTP bind errors, service errors, DB errors)
- Log **important business actions** at INFO when useful (connections, critical state changes)
- Use **DEBUG** for verbose diagnostics in development

## Levels (guideline)
- **DEBUG** — development detail (`LOG_LEVEL=DEBUG` or `LOG_SERVICE_LEVEL=DEBUG`, etc.)
- **INFO** — normal operational events (default `LOG_LEVEL`)
- **ERROR** — failures requiring attention
- **LOG_COLORS** — ANSI colors only when enabled; unrelated to log level

## Content
- Include enough context to debug (`id`, operation name) — never log secrets, full JWTs, or passwords
- Prefer structured messages with `%v` for errors after the message

## Middleware
- HTTP request/response logging is handled by `middleware.LoggerMiddleware()` — do not duplicate full access logs in every handler

## Bootstrap
- `log/logger.go` initializes log levels from config at startup (called from `main.go` via `config/`)

## Timestamps (production)
- Outside local development, the hosting infrastructure may already add timestamps.
- Disable duplicate stdlib `log` date/time flags when `ENV != development` to avoid duplicated timestamps in production logs.
