---
description: Method names CRUD verbs GetList GetOne Create Update Delete for controller handlers, application orchestrators and services.
paths:
  - "controllers/**/*.go"
  - "application/**/*.go"
  - "services/**/*.go"
---

# Method names — CRUD verbs

Controller handlers, `application/` orchestrators and services name their methods by intent, with the same verbs (not HTTP verbs glued to the resource name):

| Intent | Prefix | Examples |
|---|---|---|
| List / collection | `GetList` | `GetList`, `GetListByOwner`, `GetListHistory` |
| Single read | `GetOne` | `GetOne`, `GetOneByID`, `GetOneByExternalID` |
| Create | `Create` | `Create`, `CreateForOrder` |
| Update (PATCH/PUT) | `Update` | `Update`, `UpdateStatus` |
| Delete | `Delete` | `Delete`, `DeleteByID` |

- Suffix with a qualifier when several methods share a verb (`GetListByOwner`, `UpdateStatus`).
- A method that returns a single logical value but is not a fetch keeps an explicit name (`GetLast…`, `Compute…`) instead of a forced `GetOne`.
- **Forbidden legacy:** HTTP verbs glued to the resource (`GETme`, `POSTorder`, `PATCHorderLine`) and off-list verbs (`ListActive`).
