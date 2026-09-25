@.claude/rules/stack/STACK.md

Everything above is the **generic React Native stack**, shared with every project built on it —
never put anything project-specific there. Everything below is this project only.

## Stack rules

- Generic rules come from the `ai-rules-stack` submodule (`sub-modules/ai-rules-stack/`, stack
  `react-native`), linked into `.claude/` and `.cursor/`. Never edit them here: change them in the
  `ai-rules-stack` repo, then `make update-rules`.
- Rules for this project only live in `.claude/rules/project/` and attach by their `globs:` line.
- `.claude/settings.json` is a copy of the stack template, not a link: keep it identical.
- `make install-rules` after cloning · `make update-rules` to pull the stack · `make check-rules` to verify.
