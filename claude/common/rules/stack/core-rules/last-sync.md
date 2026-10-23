---
description: docs/.last-sync.json schema — one top-level entry per kind of sync (functional, designSystem, designs, jira), each owned by one command that never touches the others.
paths:
  - "docs/.last-sync.json"
---

# Sync anchors — `docs/.last-sync.json`

One file per repo, one top-level entry per kind of sync. Each entry has a single owner: a command reads and writes **only its own entry** and keeps every other entry as it is.

| Entry | Fields | Owner | Meaning |
|---|---|---|---|
| `functional` | `commit` | `/sync-doc` | Last commit whose changes `docs/functional/` describes |
| `designSystem` | `url`, `commit` | `/sync-design-system` | Design-system artifact, and the last code commit it reflects (front only) |
| `designs` | list of `name`, `url` | none — set by hand | The Claude Design projects or files the screens come from (several allowed); read-only for every command, shown as links by the doc viewer |
| `jira` | `url`, `project` | none — set by hand | The product's Jira project: browse URL and project key; read-only for every command |

```json
{
  "functional": { "commit": "<sha>" },
  "designSystem": { "url": "https://claude.ai/artifact/<id>", "commit": "<sha>" },
  "designs": [{ "name": "<screen or flow>", "url": "https://claude.ai/design/p/<id>?file=<file>" }],
  "jira": { "url": "https://<site>.atlassian.net/browse/<KEY>", "project": "<KEY>" }
}
```

- An entry that does not apply to the repo is left out (no `designSystem` in a backend).
- A new kind of sync gets its own top-level entry and its owner; describe it in the repo's `docs/functional/FR/README.md` ("Garder la doc à jour").
