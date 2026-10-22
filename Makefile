# Links every file of <tool>/common/ into <tool>/golang and <tool>/react-native, and converts the Claude rules (the source)
# into the Cursor and Continue ones.
# TOOLS picks which tool folders to link, e.g. `make link TOOLS="claude cursor"`.
# STACK picks the stack the Cursor converter handles: golang, react-native or all (default).
TOOLS ?= claude cursor continue
STACK ?= all

.PHONY: help link check clean cursor continue sync

help:
	@echo "make link   create / fix / prune the common symlinks (TOOLS=$(TOOLS))"
	@echo "make check  list pending changes, fail if links are out of date"
	@echo "make clean  remove every symlink pointing into common/"
	@echo "make cursor    convert the Claude rules (.md) into the Cursor ones (.mdc) (STACK=$(STACK))"
	@echo "make continue  convert the Cursor rules into the Continue ones (react-native only)"
	@echo "make sync      after editing Claude rules: link + cursor + continue"

link:
	@scripts/link-common.sh link $(TOOLS)

check:
	@scripts/link-common.sh check $(TOOLS)

clean:
	@scripts/link-common.sh clean $(TOOLS)

# Cursor rules are generated from the Claude ones: edit the Claude rule, then run this — never edit a .mdc by hand.
cursor:
	@node scripts/claude-md-to-cursor-mdc.mjs $(STACK)

# Continue rules are generated from the Cursor ones (Continue exists for react-native only).
continue:
	@node scripts/cursor-mdc-to-continue-md.mjs react-native

sync: link cursor continue
