# Make targets shared by every project that uses ai-rules-stack. A project includes the file of its stack, not this one:
#
#   include sub-modules/ai-rules-stack/make/golang.mk         (Go backends)
#   include sub-modules/ai-rules-stack/make/react-native.mk   (apps)
#
# Needs scripts/ai-rules.sh in the project (copied from <stack>/templates/ai-rules.sh).

.PHONY: check-rules submodule-update

# AI rules — fails on a missing / broken link or a settings.json that drifts from the template.
check-rules:
	@scripts/ai-rules.sh check

# Submodules — brings every submodule of the project to the latest commit of its branch, initializing the ones that
# are not yet, then checks the AI rules. On a drift it asks whether to reinstall them (`ai-rules.sh update` relinks and
# copies settings.json when missing; `install` would put the submodules back on their recorded commits). Commit the
# new pointers afterwards. Double-colon: other submodules add their own step (doc-view-stack installs its dependencies).
submodule-update::
	@git submodule update --init --remote --recursive
	@scripts/ai-rules.sh check || { \
		printf 'Écart sur les règles IA. Les réinstaller ? [o/N] '; read answer; \
		case "$$answer" in \
			[oOyY]*) scripts/ai-rules.sh update ;; \
			*) echo "Règles IA laissées telles quelles (scripts/ai-rules.sh update pour les réinstaller)." ;; \
		esac; \
	}
