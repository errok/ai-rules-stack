# Make targets of an app: check-rules, submodule-update, audit.
#   include sub-modules/ai-rules-stack/make/react-native.mk
#
# A project with its own audit on top of the stack's sets PROJECT_AUDIT := 1 before the include and defines `audit` itself.

include sub-modules/ai-rules-stack/make/common.mk

ifeq ($(PROJECT_AUDIT),)
.PHONY: audit

# Audit — the stack audit (shared .claude rules). It prints the checks that are not OK as it runs and writes its report
# under tmp/audit/<date_time>/. Exit 1 while an error remains. Options through ARGS: make audit ARGS=-v (every check,
# OK ones too), make audit ARGS=--help.
audit:
	@AUDIT_RUN=$$(date +%Y-%m-%d_%H-%M-%S) node sub-modules/ai-rules-stack/audit/react-native/audit.mjs $(ARGS)
endif
