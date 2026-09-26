---
description: Do not run go test or go test ./... proactively; only when user explicitly requests.
---

# Backend — No automatic `go test`

- Do **not** run `go test` / `go test ./...` proactively.
- Only run Go test commands when the user **explicitly asks**.
- To check that the code compiles, use `go build ./...` and `go vet ./...` instead.
