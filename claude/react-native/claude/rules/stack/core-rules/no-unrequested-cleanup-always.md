---
description: Do not remove commented code, dead code, update docs for temp workarounds, or "cleanup" without explicit user approval
globs:
---

# No unrequested cleanup

## Rule

When editing the codebase, **do not remove or "clean up"** without asking the user first:

- Commented-out code (including alternate implementations left for a near-term switch, e.g. `// return Linking.createURL(...)` while a temporary constant is used)
- `TODO` / `FIXME` comments the user or a teammate added
- Unused imports, variables, or functions — unless the user asked for a lint/format pass or the change is **required** to fix a build/error you introduced in the same edit

If you believe something should be removed or replaced, **propose it in the reply** and wait for confirmation before deleting it.

## Documentation (temporary / interim changes)

**Do not update** `README.md`, `documentation/**`, `KEYCLOAK_SETUP.md`, or similar docs to describe **temporary** workarounds (hardcoded redirects, shared bundle IDs, placeholder URLs, etc.) unless the user **explicitly** asks for doc updates.

Keep temporary state in **code comments** (`TODO`, `TODO(multi-env)`, etc.) only. Doc may reflect the **target** architecture, not every interim step.

## Allowed without asking

- Fixes strictly required for the requested task (syntax, types, broken references caused by your diff)
- Changes the user explicitly requested ("remove X", "refactor", "run biome", "fix lint")

## Example

```typescript
// ❌ Do not delete without asking
private getRedirectUri(): string {
  return KEYCLOAK_REDIRECT_URI;
}

// ✅ Keep the commented path when the user left it for a planned Keycloak change
private getRedirectUri(): string {
  // return Linking.createURL('auth/callback', {});
  return KEYCLOAK_REDIRECT_URI;
}
```
