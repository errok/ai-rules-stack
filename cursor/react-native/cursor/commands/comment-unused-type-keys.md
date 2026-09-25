---
description: Comment out unused TypeScript type properties (// key: type;) in one or more folders
---

# Unused type keys → commented lines

## Input

- The user provides **one or more folders** to analyze (paths relative to the repo root, or absolute within the workspace).
- **If no folder is given** in the message / command arguments: **ask explicitly** which folders to analyze before starting (do not assume a scope).

## File scope

- Recursively walk the given folders for relevant files: prefer `*.types.ts`, `*.dto.ts`, and any `.ts` / `.tsx` that exports `type` or `interface` shapes that are clearly API / DTO contracts (adapt if the folder does not follow that naming).

## “Unused” detection

For **each property** of **each exported type or interface** (including nested types in the same file):

1. Search the **whole project codebase** (typically `src/`) for **reads or uses** of the property outside its definition:
   - explicit access: `.propertyName`, destructuring `propertyName`, `pick` / literal keys, etc.;
   - watch for homonyms: prefer context (values typed by this DTO, props typed with it, etc.).
2. Do **not** count as usage appearing only in **the type declaration itself** or in **another file in the same target folder** if it is only a redeclaration — the goal is **app-level** usage (screens, services, hooks, etc.).

## Edit format (required)

- **Unused** property: replace it with a **fully commented line**, in the form:

  `// propertyName: Type;`

  **Do not** append explanatory text such as “unused”, “not read in app”, etc.

- **Used** property: keep the line as a normal active member.

## Follow-up cleanup

- Remove `import type` statements that become unused.
- If an exported `type` / `interface` has **no** active properties left: either comment **the entire** block (including `export type …`), or remove the export if nothing imports it — **verify** with a global search before deleting a public export.
- If a nested type is only referenced from commented lines: handle as above (fully commented block, or removal if unused).

## Deliverable

- Apply changes directly in the files.
- Summarize briefly: folders analyzed, files changed, types touched.
