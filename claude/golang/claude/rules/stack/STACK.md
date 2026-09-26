# Stack rules — Go backend

Generic layer shared by every service on this stack (reached through `.claude/rules/stack/`):
everything here must hold for *any* service. Business entities, endpoints and features
belong to the project (`.claude/rules/project/`). Claude rules link only to Claude rules
(`.md`), never to Cursor files (`.mdc`).

@.claude/rules/stack/core-rules/project-architecture-always.md
@.claude/rules/stack/core-rules/no-go-test-auto.md
