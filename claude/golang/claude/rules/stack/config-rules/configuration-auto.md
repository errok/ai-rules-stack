---
description: Environment variables ENV dev staging prod config db logger startup; Viper; no hardcoded secrets.
paths:
  - "config/**/*.go"
---

# Configuration & Environment

## Principles
- All config loaded from env vars at startup — never hardcode values
- Use **Viper** for env loading (`.env` file + `AutomaticEnv()`)
- Environments: `development`, `staging`, `production` via `ENVIRONMENT` or `ENV` var
- DB config in `config/` (dedicated struct or file)
- Auth config centralized: `SUPABASE_URL` (default IdP)
- Access config via the centralized `config` package — avoid scattered `os.Getenv()` outside `config/`

## Config structure
- Prefer typed sub-configs: `AppConfig`, `DbConfiguration`, `LoggerConfig`
- Expose accessors: `DBConfig()`, `LoggerCfg()`, `AppCfg()`

## Rules
- Never commit `.env` files with real values
- **`config/.example.env`** lists every key with placeholder values — keep it in sync when adding env vars
- Fix naming consistency between `.example.env` and `config.go` (same key names everywhere)
