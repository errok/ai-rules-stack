# Links every file of <tool>/common/ into <tool>/golang and <tool>/react-native.
# TOOLS picks which tool folders to process, e.g. `make link TOOLS="claude cursor"`.
TOOLS ?= claude cursor

.PHONY: help link check clean

help:
	@echo "make link   create / fix / prune the common symlinks (TOOLS=$(TOOLS))"
	@echo "make check  list pending changes, fail if links are out of date"
	@echo "make clean  remove every symlink pointing into common/"

link:
	@scripts/link-common.sh link $(TOOLS)

check:
	@scripts/link-common.sh check $(TOOLS)

clean:
	@scripts/link-common.sh clean $(TOOLS)
