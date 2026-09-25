#!/usr/bin/env bash
#
# Mirror every file of <tool>/common/ into each stack of that tool as a relative symlink:
#   claude/common/commands/learn.md
#     -> claude/golang/claude/commands/learn.md        (link to ../../../common/commands/learn.md)
#     -> claude/react-native/claude/commands/learn.md
#
# Links are relative, so they are versioned by git and work in any clone.
#
# Usage: scripts/link-common.sh [link|check|clean] [tool...]
#   link   create missing links, fix wrong ones, drop links whose common file is gone (default)
#   check  report what `link` would change; exit 1 when something is out of date
#   clean  remove every link that points into common/
#   tool   claude, cursor, ... (the Makefile passes both by default)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STACKS=(golang react-native)

MODE="${1:-link}"
shift || true
TOOLS=("$@")
if [ ${#TOOLS[@]} -eq 0 ]; then
  TOOLS=(claude)
fi

case "$MODE" in
  link | check | clean) ;;
  *)
    echo "Unknown mode '$MODE' (expected link, check or clean)" >&2
    exit 2
    ;;
esac

changes=0
errors=0

# Relative target from the link's folder back to the common file.
# The link sits at <tool>/<stack>/<tool>/<rel>, the file at <tool>/common/<rel>:
# climb the two stack levels plus one per folder inside <rel>, then go down into common/.
relative_target() {
  local rel="$1"
  local slashes="${rel//[^\/]/}"
  local ups=$((2 + ${#slashes}))
  local prefix=""
  local i
  for ((i = 0; i < ups; i++)); do
    prefix="../$prefix"
  done
  printf '%scommon/%s' "$prefix" "$rel"
}

report() {
  changes=$((changes + 1))
  echo "  $1"
}

link_tool() {
  local tool="$1"
  local common="$ROOT/$tool/common"

  if [ ! -d "$common" ]; then
    echo "skip $tool: no $tool/common folder"
    return
  fi

  echo "$tool:"

  for stack in "${STACKS[@]}"; do
    local stack_root="$ROOT/$tool/$stack/$tool"
    if [ ! -d "$stack_root" ]; then
      echo "  skip $stack: no $tool/$stack/$tool folder"
      continue
    fi

    # Create or fix one link per common file.
    if [ "$MODE" != "clean" ]; then
      while IFS= read -r -d '' file; do
        local rel="${file#"$common"/}"
        local link="$stack_root/$rel"
        local target
        target="$(relative_target "$rel")"
        local shown="$tool/$stack/$tool/$rel"

        if [ -L "$link" ]; then
          if [ "$(readlink "$link")" = "$target" ]; then
            continue
          fi
          report "fix    $shown"
        elif [ -e "$link" ]; then
          echo "  ERROR  $shown is a real file: move it to $tool/common or delete it" >&2
          errors=$((errors + 1))
          continue
        else
          report "create $shown"
        fi

        if [ "$MODE" = "link" ]; then
          mkdir -p "$(dirname "$link")"
          ln -sfn "$target" "$link"
        fi
      done < <(find "$common" -type f ! -name '.DS_Store' -print0 | sort -z)
    fi

    # Links into common/ whose file is gone (link) or all of them (clean).
    while IFS= read -r -d '' link; do
      local target
      target="$(readlink "$link")"
      case "$target" in
        *common/*) ;;
        *) continue ;;
      esac
      if [ "$MODE" != "clean" ] && [ -e "$link" ]; then
        continue
      fi
      report "remove ${link#"$ROOT"/}"
      if [ "$MODE" != "check" ]; then
        rm "$link"
      fi
    done < <(find "$stack_root" -type l -print0 | sort -z)
  done
}

for tool in "${TOOLS[@]}"; do
  link_tool "$tool"
done

if [ "$errors" -gt 0 ]; then
  echo "$errors conflict(s): nothing was overwritten." >&2
  exit 1
fi

if [ "$changes" -eq 0 ]; then
  echo "Everything is up to date."
elif [ "$MODE" = "check" ]; then
  echo "$changes change(s) pending: run 'make link'." >&2
  exit 1
else
  echo "$changes change(s) applied."
fi
