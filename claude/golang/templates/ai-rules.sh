#!/usr/bin/env bash
#
# AI rules — wires the ai-rules-stack submodule into this project (Claude Code + Cursor).
#
#   install  init the submodules, create / fix the stack symlinks, copy settings.json from the
#            stack template when the project has none
#   update   move every submodule under sub-modules/ to the latest commit of its branch, then
#            relink and report drift from the template — commit the new pointer afterwards
#   check    exit 1 when a link is missing, broken or wrong, or settings.json differs from the template
#
# Links are relative, so they are committed and work in any clone. Nothing real is ever
# overwritten: a file or folder sitting where a link should be is reported, not replaced.

set -euo pipefail

# Stack folder of ai-rules-stack this project uses: golang | react-native.
STACK="golang"
SUBMODULES_DIR="sub-modules"
RULES="$SUBMODULES_DIR/ai-rules-stack"

MODE="${1:-check}"
case "$MODE" in
  install | update | check) ;;
  *)
    echo "Usage: scripts/ai-rules.sh [install|update|check]" >&2
    exit 2
    ;;
esac

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# link path (from the repo root) | what it points to (from the repo root)
LINKS=(
  ".claude/rules/stack|$RULES/claude/$STACK/claude/rules/stack"
  ".claude/hooks|$RULES/claude/$STACK/claude/hooks"
  ".claude/commands|$RULES/claude/$STACK/claude/commands"
  ".cursor/rules/stack|$RULES/cursor/$STACK/cursor/rules/stack"
  ".cursor/commands|$RULES/cursor/$STACK/cursor/commands"
  ".cursorignore|$RULES/cursor/$STACK/cursorignore"
)
SETTINGS=".claude/settings.json"
SETTINGS_TEMPLATE="$RULES/claude/$STACK/templates/settings.json"

problems=0

problem() {
  problems=$((problems + 1))
  echo "  ✗ $1"
}

# A link at a/b/c must climb two folders before reaching the repo root.
relative_target() {
  local link="$1" target="$2"
  local slashes="${link//[^\/]/}"
  local prefix="" i
  for ((i = 0; i < ${#slashes}; i++)); do
    prefix="../$prefix"
  done
  printf '%s%s' "$prefix" "$target"
}

sync_links() {
  echo "Links ($STACK):"
  local entry link target expected
  for entry in "${LINKS[@]}"; do
    link="${entry%%|*}"
    target="${entry#*|}"
    expected="$(relative_target "$link" "$target")"

    if [ -L "$link" ] && [ "$(readlink "$link")" = "$expected" ]; then
      if [ -e "$link" ]; then
        echo "  ✓ $link"
      else
        problem "$link -> $expected is broken: run 'scripts/ai-rules.sh install' (submodule not initialized?)"
      fi
      continue
    fi

    if [ -e "$link" ] && [ ! -L "$link" ]; then
      problem "$link is a real file or folder: move its content to the stack or delete it, then rerun"
      continue
    fi

    if [ "$MODE" = "check" ]; then
      if [ -L "$link" ]; then
        problem "$link points to $(readlink "$link"), expected $expected"
      else
        problem "$link is missing"
      fi
      continue
    fi

    mkdir -p "$(dirname "$link")"
    ln -sfn "$expected" "$link"
    if [ -e "$link" ]; then
      echo "  + $link -> $expected"
    else
      problem "$link -> $expected created but its target does not exist in the submodule"
    fi
  done
}

sync_settings() {
  echo "Settings:"
  if [ ! -f "$SETTINGS_TEMPLATE" ]; then
    echo "  ! no template at $SETTINGS_TEMPLATE (older stack commit?) — $SETTINGS left as is"
    return
  fi

  if [ ! -e "$SETTINGS" ]; then
    if [ "$MODE" = "check" ]; then
      problem "$SETTINGS is missing: run 'scripts/ai-rules.sh install'"
    else
      cp "$SETTINGS_TEMPLATE" "$SETTINGS"
      echo "  + $SETTINGS copied from the template"
    fi
    return
  fi

  if [ -L "$SETTINGS" ]; then
    problem "$SETTINGS is a symlink: it must be a real copy, Claude Code reads it before the submodule exists"
  elif cmp -s "$SETTINGS" "$SETTINGS_TEMPLATE"; then
    echo "  ✓ $SETTINGS matches the template"
  else
    problem "$SETTINGS differs from the template: review 'diff $SETTINGS $SETTINGS_TEMPLATE' and copy it over if the change is wanted"
  fi
}

case "$MODE" in
  install)
    echo "Initializing submodules…"
    git submodule update --init --recursive -- "$SUBMODULES_DIR"
    ;;
  update)
    echo "Updating submodules to the latest commit of their branch…"
    git submodule update --init --remote --recursive -- "$SUBMODULES_DIR"
    ;;
esac

sync_links
sync_settings

if [ "$MODE" = "update" ]; then
  if git diff --quiet -- "$SUBMODULES_DIR"; then
    echo "Submodules were already up to date."
  else
    echo "New submodule commits — commit the pointers:"
    git status --short -- "$SUBMODULES_DIR"
    echo "  git add $SUBMODULES_DIR && git commit -m \"chore(ai-rules): update stack\""
  fi
fi

if [ "$problems" -gt 0 ]; then
  echo "$problems problem(s)." >&2
  exit 1
fi
echo "AI rules OK."
