# Stack rules — React Native

**Generic layer, shared by every project built on this stack.** Consuming projects
`@`-import this file from their own `CLAUDE.md`, then declare what is specific to
them. It is reached through the symlink `.claude/rules/stack/`, so everything here
must hold for *any* app on the stack.

Ported from `.cursor/` (Cursor rules, symlinked). **Do not edit `.cursor/`** — it
is the upstream source; change rules here under `.claude/` instead.

## Generic vs project

| Goes here (`rules/stack/`) | Goes in the project (`rules/project/`) |
|---|---|
| Naming, token layers, folder structure, HTTP/store/navigation contracts | Palette **values**, theme decisions, product exceptions, domain vocabulary |

Rule of thumb: if the sentence names a color, a feature, or a screen, it belongs
to the project, not here.

## How rules attach

- **Always-on rules** are `@`-imported just below — always in context.
- **Domain rules** live under `.claude/rules/stack/**` with a `globs:` line in their
  frontmatter. The `PreToolUse` hook `.claude/hooks/inject-rules.mjs` (wired in
  `.claude/settings.json`) reads that `globs:` and, right before any
  `Edit`/`Write`, injects every rule whose glob matches the target file — once
  per session, re-injected after a context compaction (`PreCompact` clears the
  cache). No manual step needed; the table below is reference + fallback if hooks
  are disabled. The user can also `@`-mention a rule directly.
- To add/change a rule, follow `.claude/rules/stack/core-rules/rule-manager-agent.md`:
  the `globs:` line is what drives injection — keep it accurate — and keep the
  table below in sync (`/optimize-rule-attachment` rebuilds it).

## Always-on rules

@.claude/rules/stack/core-rules/project-architecture-always.md
@.claude/rules/stack/core-rules/naming-auto.md
@.claude/rules/stack/core-rules/no-unrequested-cleanup-always.md

## Domain rules (read before editing matching paths)

| Paths | Rule |
|---|---|
| `services/auth/**` | `.claude/rules/stack/auth-rules/supabase-auth-auto.md` — authService barrel only, MMKV session, `onAuthStateChange`, token access for HTTP |
| `screens/**/*.tsx`, `components/**/*.tsx`, `navigation/**/*.tsx`, `components/ds/index.ts`, `components/ds/composed/index.ts` | `.claude/rules/stack/component-rules/component-screen-structure-auto.md` — file naming, no `React.FC`, route params typing, mandatory comment sections, barrels |
| `components/**/*.tsx`, `screens/**/*.tsx` | `.claude/rules/stack/component-rules/ds-icon-auto.md` — centralize icons via `DsIcon` / `EDsIconName` |
| `components/ds/**`, `components/ds/composed/**`, `screens/**/*.tsx` | `.claude/rules/stack/component-rules/ds-layering-auto.md` — `ds` primitives vs `ds/composed`; product chrome stays in `components/` |
| `components/ds/composed/**/*.tsx`, `components/ds/**/*Modal*.tsx`, `components/**/*Modal*.tsx`, `screens/**/*.tsx` | `.claude/rules/stack/component-rules/ds-modal-auto.md` — `DsModal` vs `DsModalFullScreen`, `EDsModalMode`, `MODAL_MODE_CONFIG` |
| `components/ds/**`, `design-tokens/components/**`, `components/DevDebugMenu/**` | `.claude/rules/stack/component-rules/ds-new-component-auto.md` — new `Ds*` checklist: token hierarchy, no hex, DevDebugMenu lab, barrels |
| `components/ds/**`, `components/ds/composed/**`, `components/**/*.tsx`, `design-tokens/components/**` | `.claude/rules/stack/component-rules/ds-no-product-override-auto.md` — product apps never fork the DS; missing API → `/promote-ds`, chrome → `components/` |
| `components/**/*.tsx`, `screens/**/*.tsx` | `.claude/rules/stack/component-rules/formwebview-auto.md` — shared Form WebView wrapper, no ad-hoc per-screen `WebView` |
| `components/**/*.tsx`, `screens/**/*.tsx` | `.claude/rules/stack/component-rules/handle-callback-prefix-auto.md` — `handle*` prefix for functions passed to JSX |
| `components/**/*.tsx`, `screens/**/*.tsx` | `.claude/rules/stack/component-rules/nativewind-gap-spacing-auto.md` — `gap-*` on flex parent, limit child margins, never `space-*` |
| `screens/**/*.tsx`, `components/**/*.tsx`, `components/ds/DsContainer.tsx`, `components/ds/DsScrollView.tsx` | `.claude/rules/stack/component-rules/ds-container-scrollview-padding-auto.md` — one horizontal padding owner: default `DsContainer` **or** `DsScrollView enablePadding` + `disablePadding`, never both |
| `screens/**/*.tsx` | `.claude/rules/stack/component-rules/screens-error-handling-auto.md` — screens own `try/catch` + error UX; services never catch; no RN `Alert` |
| `components/**/*.{ts,tsx}`, `screens/**/*.tsx` | `.claude/rules/stack/component-rules/useeffect-no-inline-functions-auto.md` — no anonymous functions inside `useEffect`; declare + `useCallback` |
| `services/**` | `.claude/rules/stack/service-rules/services-http-auto.md` — `r` / `rPublic` helper, no raw `fetch`, `Dto` types, errors bubble to screens |
| `navigation/**` | `.claude/rules/stack/stack-rules/react-navigation-auto.md` — `*Stack` vs `*Navigator`, per-section `{section}.types.ts`, route enums, param lists |
| `stores/**` | `.claude/rules/stack/store-rules/zustand-stores-auto.md` — `create()`, `T{Name}Store`, MMKV persist + `partialize`, no HTTP in stores, `clearStores` |
| `hooks/**/*.ts`, `services/**/*.ts`, `stores/**/*.ts`, `screens/**/*.tsx`, `components/**/*.tsx`, `utils/**/*.ts` | `.claude/rules/stack/ts-rules/async-await-no-promise-chains-auto.md` — prefer `async`/`await` + `try/catch/finally` over `.then` chains |
| `**/*.ts`, `**/*.tsx` | `.claude/rules/stack/ts-rules/typescript-conventions-auto.md` — `type` not `interface`, `import type`, no `any`, Biome formatting + import order |
| `tailwind.config.js`, `design-tokens/**`, `tailwind/**` | `.claude/rules/stack/ui-rules/design-tokens-tailwind-auto.md` — primitives → semantic → component token layers, generic token names (rebrand = values only), `light`/`dark` + `reverse` roles, blocklist, `withAlpha` |
| `screens/**/*.tsx`, `components/**/*.tsx`, `hooks/**/*.ts`, `stores/**/*.ts` | `.claude/rules/stack/ui-rules/loading-flags-naming.md` — `is{Domain}Loading` boolean flag naming |
| `components/**/*.tsx`, `screens/**/*.tsx` | `.claude/rules/stack/ui-rules/markdown-display-auto.md` — shared Markdown wrapper, `reverse` only on theme-inverted surfaces |
| `components/Picto/**` | `.claude/rules/stack/ui-rules/picto-components-auto.md` — pictograms live under `components/Picto/`, small `size`/`color`/`circle` API |
| `assets/**/*.svg` | `.claude/rules/stack/ui-rules/svg-assets-auto.md` — root `color="#000000"` fallback, `stroke`/`fill="currentColor"`, no white/black glyph variants |

On request only: `.claude/rules/stack/core-rules/rule-manager-agent.md` — how to create/update/delete rules, skills, and commands.

## Commands (`/name`)

- `/commit` — split the working tree into focused Conventional Commits (English)
- `/review` — review the current diff against these rules (French deliverable)
- `/learn` — infer rules/skills/commands from the git delta since `.claude/gitanchor` + this conversation
- `/optimize-rule-attachment` — tune rule globs/descriptions and rebuild the table above
- `/promote-ds` — neutralize `Ds*` APIs from a product branch onto stack `main`, then rebase
- `/fixsvg` — make icon SVGs tintable via the RN `color` prop
- `/comment-unused-type-keys` — comment out unused TypeScript type properties in given folders
- `/integrate-design` — set session context for building a screen/feature from a design reference (Claude Design artifact, HTML prototype, screenshot): visual reference only, reuse existing `ds`/`ds/composed` components, one component at a time with a plan before code
