---
name: promote-ds
description: Neutralize Ds* APIs from the current product branch onto stack main, then rebase the product branch
---

# `/promote-ds` — product DS APIs → neutral stack `main`

**Direction:** product apps **feed** the stack. The stack stays **neutral**. This is the inverse of “fork main and skin it”.

```
product invents Ds* API
  → copy API + labs onto main
  → neutralize tokens (stack semantic / stack hex only)
  → rebase product onto main
  → product MUST NOT keep DS file forks (primitives **or** `ds/composed`) — theme via primitives/semantic; extra chrome in `components/`
```

Invoke on the **product feature branch**, not on `main`.

## Safety

- Never update git config.
- Never `--no-verify` / `--no-gpg-sign` unless the user explicitly asks.
- Never force-push. Never push unless the user explicitly asks.
- Never `git rebase -i`. Never `git add -i`.
- Do not promote secrets (`.env`, credentials).
- If `HEAD` is `main` (or `master`): **stop**.
- Prefer a local `chore/promote-ds` branch, typecheck, then **ff-merge into local `main`**. Do not rewrite published `main` history.

## Git history — no donor

The commit on **`main` must read as if authored there**. Never put in a commit subject/body (nor comments/docs added in this command):

- the feature branch name
- the donor product / app name
- “promote”, “backfill”, “from `<branch>`”, “snapshot”, “landed from …”

Write a normal `feat(ds): …` that describes **what the DS gained**. Chat may name the current branch; git objects must not.

## Neutralize (mandatory)

`main` is a generic DS. **Never** copy a product brand layer onto it.

### API vs product chrome (existing `Ds*`)

The product branch **must not fork** `components/ds/**` (primitives **and** `ds/composed`) or DS `design-tokens/components/ds/**`. `DsFab` / `DsModal` / tiles are the same contract as `DsButton`.

| Need | Where it lands |
|---|---|
| Missing **public API** (new prop, variant, `DsChip`, `DsFab`) | **`main`** (neutralize) |
| Product **look / chrome** (gradient CTA, halo, domain row) | **`components/`** — no `Ds` prefix; compose `Ds*`. **Not** `ds/composed` |
| Theme (palette, type, `surface.ghost` **values**) | Product **primitives / semantic** only |

**Mixed `Ds*` (primitive or composed):** copy **API hunks** onto `main` (e.g. `type="ghost"`). Do **not** leave LinearGradient / pill / product fonts in `DsButton` / `DsFab` (or any `Ds*`) on the product branch — extract that widget under `components/` or drop it if `main` is enough.

After rebase, `git diff main -- components/ds` must be **empty** (includes `ds/composed`). Same for DS-owned `design-tokens/components/ds/**`. App-owned token modules (`halo.js`, …) may stay on the product branch.

### Tokens

- **Do not** `git checkout FEATURE --` `design-tokens/primitives/**`, `design-tokens/semantic/colors.js`, `design-tokens/semantic/typography.js`, `hooks/useAppFonts.ts`, font packages, `theme/navigationTheme.ts` font families.
- New `design-tokens/components/ds/{name}.js` (or `ds/composed/{name}.js`): **rewrite** so every color/size maps to **`main`’s existing** `sl.*` (or a role you just added — see below). Strip donor comments (`dark-only`, product names). On `main`, `dark: {}` until the stack defines dark.
- Product hex, domain wheels, brand gradients (`gradient.*` product keys), product radius scales: **never**.

### Missing semantic role

If a new `Ds*` reads a semantic key `main` does not have:

**Add the role on `main`** using **`main` primitives only** — same *contract*, stack-neutral values. Do not paste donor hex.

Example — `surface.ghost` (quiet **achromatic** fill+border; quieter than chromatic `surface.subtle`):

```js
ghost: {
  background: withAlpha(neutral[1000], 0.04),
  border: withAlpha(neutral[1000], 0.12),
},
```

Ink veil on light UI. After rebase, the product rebinds the same key to its own veil (e.g. white alpha on dark).

Do **not** add product-only roles (`marker.*`, life-domain maps, `gradient.<product>`).

### Icons

Anything that shows a DS icon goes through **`DsIcon`** (chip, fab, icon button = composed). Generic new SVGs → `assets/icons` + `EDsIconName` on `main`. Product glyphs (`DomainPicto`, life-domain marks) stay on the product branch.

## What to land on `main`

| Include | Examples |
|---|---|
| New / extended `Ds*` **API** | `DsChip`, `DsFab`, `DsProgressBar`, callout `brand`, checkbox `circle` |
| Barrels | `components/ds/index.ts`, `composed/index.ts` — only the new exports |
| Neutralized component token modules | `design-tokens/components/ds/chip.js` (or `ds/composed/…`) rewritten against `main` `sl.*` |
| New generic semantic roles | `surface.ghost` with stack alphas (above) |
| DS labs + `DsCatalog` rows | `_devDebugMenu/ds/Ds{Name}/**`, catalog wiring for those labs |
| Generic `DsIcon` assets | `folder.svg`, `star.svg`, … |

## What stays on the product branch

| Exclude | Examples |
|---|---|
| App widgets | `Halo`, `TaskRow`, `ChoiceRow`, cards, `components/chip/**`, `Picto/**` |
| App catalog | `_devDebugMenu/AppCatalog.tsx`, `_devDebugMenu/app/**` |
| Hub rows for App components | `DebugHub` / `DevDebugMenu` product entries |
| Brand **theme** | primitives/semantic palettes, fonts, domain colors |
| App-owned component tokens | `design-tokens/components/halo.js` (pairs with `Halo.tsx`, not a `Ds*`) |

**Mixed hub/shell files:** do not checkout the whole file. Skip or apply DS-only hunks.

## Git cwd

Use tool `working_directory` = this repo root, or `git -C <abs-repo>`.

---

## Workflow

Run first (parallel):

```bash
git status
git branch -vv
git rev-parse --abbrev-ref HEAD
git merge-base HEAD main
git log --oneline main..HEAD
git diff --stat main
```

`FEATURE` = current branch. Abort if it is `main`.

### 1. Classify

From `git diff --name-status main` + untracked: **PROMOTE** vs **KEEP**. Print both **before** switching.

For each PROMOTE `Ds*`: list `sl.*` keys it reads. Keys missing on `main` → add **generic** roles (stack primitives). Keys that are product-only → remap or drop, do not copy.

### 2. Snapshot dirty tree

Rebase cannot run dirty.

1. Stash KEEP (pathspecs, `-u`):

   ```bash
   git stash push -u -m "promote-ds: product wip" -- <KEEP paths>
   ```

2. If PROMOTE is still dirty, commit a checkpoint on `FEATURE` (`wip(ds): checkpoint design-system files` — no product/branch/`main` in the message).

Do **not** stash PROMOTE paths.

### 3. Neutral landing branch

```bash
git switch main
git switch -c chore/promote-ds
```

Then **selectively**:

- `git checkout FEATURE --` **only** new/extended `Ds*` files, labs, generic icons, barrels.
- **Never** checkout product primitives/semantic/fonts.
- If an existing `Ds*` is mixed (API + product chrome): copy **API only** onto `main`; product chrome must move to `components/` (not stay as a DS fork).
- Write/rewrite `design-tokens/components/ds/{new}.js` (or `ds/composed/{new}.js`) against **this branch’s** `sl.*`.
- Add missing generic semantic keys on `main`’s `semantic/colors.js` (stack hex).
- `git rm` DS paths the product deleted for a real DS merge (`DsBadge` → `DsChip`). Do **not** re-create `DsHalo` if it moved to an app widget.
- Restore accidental KEEP files: `git checkout main -- <path>`.

`git status` must show only neutralized DS.

Commit as if authored on `main`:

```bash
git commit -m "$(cat <<'EOF'
feat(ds): add chip, fab, and progress bar primitives

Replace DsBadge with DsChip. Extend callout, checkbox, text, and icon.
EOF
)"
```

Adjust to **this** diff. Skip empty commits.

```bash
npx tsc --noEmit
```

Fix missing barrels/token maps on `chore/promote-ds`. If product widgets leaked in, revert them. Do not ff-merge a red `main`.

```bash
git switch main
git merge --ff-only chore/promote-ds
```

If ff-only fails: stop. No merge commit unless the user asks.

### 4. Rebase `FEATURE` onto `main`

```bash
git switch FEATURE
git rebase main
```

During rebase: **ours** = `main`, **theirs** = replayed commit.

| Path class | Resolution |
|---|---|
| Neutral DS already on `main` | `git checkout --ours -- <path>` then `git add` — product must **not** re-apply DS forks |
| Product KEEP (`components/` widgets, primitives/semantic) | `git checkout --theirs -- <path>` then `git add` |
| Semantic/primitives product brand vs new generic key | keep **product values** for existing keys; keep **both** if `main` added a new key the product should inherit then restyle — **stop** if unclear |
| Unclear | **stop**, show both sides |

`git rebase --continue` (non-interactive). Empty replay (DS already on `main`): `git rebase --skip`.

Then `git stash pop` if you stashed. KEEP = product files.

### 5. Report (French chat)

- `FEATURE` + `main` SHA
- PROMOTE vs KEEP
- semantic roles **added** on `main` (name + stack mapping, e.g. `surface.ghost` → ink 0.04/0.12)
- commits (donor-free)
- rebase outcome
- stash
- `tsc`
- nothing pushed

## Do not

- Leave product forks of `components/ds/**` after rebase (gradient `DsButton`, `DsFab` + `gradient.krono`, Outfit fallbacks in `DsText` / tiles, …). Missing API → `main`; chrome → `components/` (not `ds/composed`).
- Copy donor palettes wholesale or name the donor in git commits.
- Promote app widgets / App catalog / Halo-as-app as if they were `Ds*`.
- Delete the feature branch.
