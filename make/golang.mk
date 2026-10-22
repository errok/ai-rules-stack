# Make targets of a Go backend: check-rules, submodule-update, audit.
#   include sub-modules/ai-rules-stack/make/golang.mk

include sub-modules/ai-rules-stack/make/common.mk

.PHONY: audit

# Audit — checks the code against the stack's .claude rules (its own Go module), prints the checks that are not OK as
# they run and writes tmp/audit/<date_time>/stack/report.md, one folder per run kept as a trace (exit 1 while an error
# remains). Options through ARGS: make audit ARGS=-v (every check, OK ones too), make audit ARGS=--help.
audit:
	@cd sub-modules/ai-rules-stack/audit/golang && go run . -root $(CURDIR) $(ARGS)
