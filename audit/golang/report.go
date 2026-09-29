package main

import (
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type result struct {
	check      check
	findings   []finding
	suppressed int
}

// runChecks runs every check in order and hands each result to onResult as soon as it is ready.
func runChecks(p *project, checks []check, onResult func(result)) []result {
	results := make([]result, 0, len(checks))
	for _, c := range checks {
		r := result{check: c}
		for _, f := range c.run(p) {
			if p.ignored(f, c.id) {
				r.suppressed++
				continue
			}
			r.findings = append(r.findings, f)
		}
		sort.SliceStable(r.findings, func(i, j int) bool {
			if r.findings[i].file != r.findings[j].file {
				return r.findings[i].file < r.findings[j].file
			}
			return r.findings[i].line < r.findings[j].line
		})
		onResult(r)
		results = append(results, r)
	}
	return results
}

// ignored reports whether the finding is silenced by `audit-ignore <id>`: on its line or the line above, or
// anywhere in the file for a finding without a line. Tooling checks (compiler, formatter) are never silenced.
func (p *project) ignored(f finding, id string) bool {
	if f.file == "" || !ignorable(id) {
		return false
	}
	var lines []string
	if file := p.byRel[f.file]; file != nil {
		lines = file.lines
	} else if src, err := os.ReadFile(filepath.Join(p.root, f.file)); err == nil {
		// A non-Go file (.env, SQL…): its own comment syntax, same marker.
		lines = strings.Split(string(src), "\n")
	}
	if f.line == 0 {
		for _, l := range lines {
			if strings.Contains(l, "audit-ignore") && strings.Contains(l, id) {
				return true
			}
		}
		return false
	}
	for _, n := range []int{f.line - 1, f.line - 2} {
		if n >= 0 && n < len(lines) && strings.Contains(lines[n], "audit-ignore") && strings.Contains(lines[n], id) {
			return true
		}
	}
	return false
}

func writeReport(p *project, results []result, out string) error {
	reportDir := filepath.Dir(out)
	link := func(rel string, line int, label string) string {
		target, _ := filepath.Rel(reportDir, filepath.Join(p.root, rel))
		target = filepath.ToSlash(target)
		if line > 0 {
			return fmt.Sprintf("[%s](%s#L%d)", label, target, line)
		}
		return fmt.Sprintf("[%s](%s)", label, target)
	}
	ruleLink := func(rule string) string {
		return link(".claude/rules/"+rule, 0, rule)
	}

	var b strings.Builder
	w := func(format string, args ...any) { fmt.Fprintf(&b, format+"\n", args...) }

	counts := map[severity]int{}
	suppressed, ok := 0, 0
	for _, r := range results {
		suppressed += r.suppressed
		if len(r.findings) == 0 {
			ok++
		} else {
			counts[r.check.sev]++
		}
	}

	w("# Audit du stack Go — %s", appName)
	w("")
	w("> Généré par `make audit` le %s — ne pas modifier à la main, relancer la commande.", time.Now().Format("02/01/2006 à 15:04"))
	w("> Commit %s", gitState(p.root))
	w("")
	w("**%d points vérifiés : ✅ %d OK · ❌ %d en erreur · 🟠 %d à vérifier · 🔵 %d suggestion(s)** · %d cas écarté(s) par `audit-ignore`.",
		len(results), ok, counts[sevError], counts[sevWarn], counts[sevInfo], suppressed)
	w("")
	w("## Statuts")
	w("")
	w("| Statut | Signification |")
	w("|---|---|")
	w("| ✅ OK | la règle est respectée partout |")
	for _, sev := range []severity{sevError, sevWarn, sevInfo} {
		w("| %s | %s |", sevStatus[sev], sevMeaning[sev])
	}
	w("")
	w("La **référence** (`B-ARCH-01`…) est l'identifiant stable du point : elle relie la console, ce rapport, `/audit` et les commentaires `audit-ignore`.")
	w("")
	w("## Comment traiter ce rapport")
	w("")
	w("Écrit pour qui corrige — un développeur ou une IA :")
	w("")
	w("- Chaque section du détail est un point en échec : ce qui est attendu, pourquoi, comment corriger, la règle d'origine (à lire avant de corriger), puis chaque endroit concerné en `fichier:ligne`.")
	w("- Traiter dans l'ordre ❌ → 🟠 → 🔵, relancer `make audit` après chaque lot, ne jamais modifier ce rapport.")
	w("- Un cas légitime se justifie dans le code, sur sa ligne ou la ligne au-dessus : `// audit-ignore <référence>: <raison>`.")
	w("- Supprimer du code (code commenté, clés inutilisées, champs) demande l'accord de l'utilisateur : le proposer, ne pas le faire en silence.")
	w("- Le contrat front ↔ back (DTO, requêtes, routes) se vérifie depuis l'app : `make audit` dans `../%s`.", strings.TrimSuffix(appName, "-back"))
	w("")

	w("## Vue d'ensemble")
	w("")
	w("| Statut | Point vérifié | Référence | Règle | Endroits |")
	w("|---|---|---|---|---|")
	for _, r := range results {
		status := "✅ OK"
		if len(r.findings) > 0 {
			status = sevStatus[r.check.sev]
		}
		w("| %s | %s | `%s` | %s | %d |", status, textOf(r.check).title, r.check.id, ruleLink(r.check.rule), len(r.findings))
	}
	w("")

	w("## Détail des points en échec")
	w("")
	hasFindings := false
	for _, sev := range []severity{sevError, sevWarn, sevInfo} {
		for _, r := range results {
			if r.check.sev != sev || len(r.findings) == 0 {
				continue
			}
			hasFindings = true
			t := textOf(r.check)
			w("### %s — %s `%s`", sevStatus[sev], t.title, r.check.id)
			w("")
			w("- **Attendu :** %s", t.expected)
			w("- **Pourquoi :** %s", t.why)
			w("- **Comment corriger :** %s", t.fix)
			w("- **Pour ignorer :** %s", ignoreHint(r.check))
			w("- **Règle :** %s", ruleLink(r.check.rule))
			w("- **Où (%s) :**", places(len(r.findings)))
			w("")
			for _, f := range r.findings {
				where := "(projet)"
				if f.file != "" {
					where = link(f.file, f.line, fmt.Sprintf("%s:%d", f.file, f.line))
					if f.line == 0 {
						where = link(f.file, 0, f.file)
					}
				}
				w("  - %s — %s", where, f.msg)
			}
			w("")
		}
	}
	if !hasFindings {
		w("Rien à corriger.")
		w("")
	}

	w("## Règles sans vérification automatique")
	w("")
	w("Aucun point ci-dessus ne couvre ces fichiers de règles (`.claude/rules/stack`) — à relire à la main avant une release :")
	w("")
	covered := map[string]bool{}
	for _, r := range results {
		covered[r.check.rule] = true
	}
	for _, rule := range listRules(p.root, "stack") {
		if !covered[rule] {
			w("- %s", ruleLink(rule))
		}
	}
	w("")
	w("Une règle couverte garde aussi des consignes qu'aucun script ne peut juger (place de la logique métier, contenu des logs, qualité des noms) : couverte ne veut pas dire entièrement vérifiée.")

	if err := os.MkdirAll(reportDir, 0o755); err != nil {
		return err
	}
	return os.WriteFile(out, []byte(b.String()), 0o644)
}

// listRules lists the rule files of .claude/rules/<scope> (the stack folder is a symlink) as `<scope>/…/x.md`.
func listRules(root, scope string) []string {
	base := filepath.Join(root, ".claude", "rules")
	var rules []string
	for _, e := range []string{scope} {
		dir, err := filepath.EvalSymlinks(filepath.Join(base, e))
		if err != nil {
			continue
		}
		_ = filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
			if err != nil || d.IsDir() || !strings.HasSuffix(path, ".md") || d.Name() == "README.md" || d.Name() == "STACK.md" {
				return nil
			}
			rel, _ := filepath.Rel(dir, path)
			rules = append(rules, e+"/"+filepath.ToSlash(rel))
			return nil
		})
	}
	sort.Strings(rules)
	return rules
}

func gitState(dir string) string {
	sha, err := exec.Command("git", "-C", dir, "rev-parse", "--short", "HEAD").Output()
	if err != nil {
		return "inconnu"
	}
	state := "`" + strings.TrimSpace(string(sha)) + "`"
	if status, _ := exec.Command("git", "-C", dir, "status", "--porcelain").Output(); len(strings.TrimSpace(string(status))) > 0 {
		state += " + modifications non commitées"
	}
	return state
}
