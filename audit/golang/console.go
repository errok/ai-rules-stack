package main

import (
	"fmt"
	"strings"
	"unicode/utf8"
)

// Console output: each check is printed as soon as it has run, with the detail of what fails.

var sevStatus = map[severity]string{sevError: "❌ ERREUR", sevWarn: "🟠 À VÉRIFIER", sevInfo: "🔵 SUGGESTION"}

var sevMeaning = map[severity]string{
	sevError: "à corriger avant la release",
	sevWarn:  "à corriger, ou à justifier avec `audit-ignore` si c'est voulu",
	sevInfo:  "ménage, rien de bloquant",
}

// groupTitles names the area of a check ID (B-<AREA>-NN).
var groupTitles = map[string]string{
	"ARCH": "Architecture — frontières entre couches",
	"TYPE": "Types et fichiers",
	"FILE": "Types et fichiers",
	"DB":   "Base de données",
	"API":  "API — contrôleurs et routes",
	"SEC":  "Sécurité",
	"GO":   "Conventions Go",
	"LOG":  "Logs",
	"CFG":  "Configuration",
	"TOOL": "Outillage",
}

// consoleDetailLimit caps the places printed for a suggestion; errors and checks to review print them all.
const consoleDetailLimit = 5

var (
	lastGroup string
	// afterBlock / afterHeader keep exactly one blank line around the detail block of a failing check.
	afterBlock, afterHeader bool
)

func printHeader() {
	fmt.Printf("Audit du stack Go — %s\n", appName)
	fmt.Println()
	fmt.Println("Statuts :")
	fmt.Println("✅ OK")
	for _, sev := range []severity{sevError, sevWarn, sevInfo} {
		fmt.Printf("%s (%s)\n", sevStatus[sev], plain(sevMeaning[sev]))
	}
	fmt.Println()
	fmt.Println("La référence entre crochets (ex. [B-ARCH-01]) désigne le point dans le rapport, dans /audit et dans audit-ignore.")
}

func groupOf(id string) string {
	parts := strings.Split(id, "-")
	if len(parts) < 2 {
		return ""
	}
	return groupTitles[parts[1]]
}

// printResult prints one check right after it ran: its status, then what to do and where when it fails.
func printResult(r result) {
	if g := groupOf(r.check.id); g != lastGroup {
		bar := strings.Repeat("*", utf8.RuneCountInString(g))
		fmt.Printf("\n%s\n%s\n%s\n", bar, g, bar)
		lastGroup = g
		afterHeader, afterBlock = true, false
	}
	t := textOf(r.check)
	if len(r.findings) == 0 {
		if afterBlock {
			fmt.Println()
		}
		fmt.Printf("  ✅ OK  %s  [%s]\n", t.title, r.check.id)
		afterHeader, afterBlock = false, false
		return
	}
	if !afterHeader {
		fmt.Println()
	}
	afterHeader, afterBlock = false, true
	fmt.Printf("  %s  %s  [%s] — %s\n", sevStatus[r.check.sev], t.title, r.check.id, places(len(r.findings)))
	fmt.Printf("       Attendu          : %s\n", plain(t.expected))
	fmt.Printf("       Pourquoi         : %s\n", plain(t.why))
	fmt.Printf("       Où               :\n")
	limit := len(r.findings)
	if r.check.sev == sevInfo && limit > consoleDetailLimit {
		limit = consoleDetailLimit
	}
	for _, f := range r.findings[:limit] {
		where := "(projet)"
		if f.file != "" {
			where = f.file
			if f.line > 0 {
				where = fmt.Sprintf("%s:%d", f.file, f.line)
			}
		}
		fmt.Printf("         • %s — %s\n", where, plain(f.msg))
	}
	if limit < len(r.findings) {
		fmt.Printf("         … et %d autre(s), voir le rapport\n", len(r.findings)-limit)
	}
	fmt.Printf("       Comment corriger : %s\n", plain(t.fix))
	fmt.Printf("       Pour ignorer     : %s\n", plain(ignoreHint(r.check)))
}

// ignorable: a compiler or formatter error is fixed, never silenced.
func ignorable(id string) bool { return !strings.Contains(id, "-TOOL-") }

// ignoreHint tells how to mark a finding as intended, with the exact comment to copy.
func ignoreHint(c check) string {
	if !ignorable(c.id) {
		return "impossible, il faut corriger."
	}
	return fmt.Sprintf("`// audit-ignore %s: <raison>`", c.id)
}

// places reads "1 endroit" / "3 endroits".
func places(n int) string {
	if n == 1 {
		return "1 endroit"
	}
	return fmt.Sprintf("%d endroits", n)
}

func printSummary(results []result, reportPath string) (errors int) {
	counts := map[severity]int{}
	ok := 0
	for _, r := range results {
		if len(r.findings) == 0 {
			ok++
			continue
		}
		counts[r.check.sev]++
		if r.check.sev == sevError {
			errors += len(r.findings)
		}
	}
	fmt.Printf("\nBilan : %d points vérifiés — ✅ %d OK · ❌ %d en erreur · 🟠 %d à vérifier · 🔵 %d suggestion(s)\n",
		len(results), ok, counts[sevError], counts[sevWarn], counts[sevInfo])
	fmt.Printf("Rapport détaillé : %s\n", reportPath)
	return errors
}

// plain drops the markdown backticks for the terminal.
func plain(s string) string { return strings.ReplaceAll(s, "`", "") }
