package main

import (
	"bytes"
	"fmt"
	"go/ast"
	"go/format"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

const (
	ruleSecurity = "stack/security-rules/security-auto.md"
	ruleLogging  = "stack/logging-rules/logging-auto.md"
	ruleConfig   = "stack/config-rules/configuration-auto.md"
	ruleNoGoTest = "stack/core-rules/no-go-test-auto.md"
)

var commentedCode = regexp.MustCompile(`^//\s*(if .*\{$|for .*\{$|return\b|func \w|var \w+ |[a-zA-Z_][\w.]*\s*:?=\s*\S|\}\s*$|[a-z]\w*\.[A-Z]\w*\(.*\)\s*$)`)

func miscChecks() []check {
	return []check{
		{
			id: "B-SEC-01", rule: ruleSecurity, sev: sevError,
			run: func(p *project) []finding {
				var out []finding
				for _, f := range p.files {
					httpName, ok := f.imports["net/http"]
					if !ok {
						continue
					}
					ast.Inspect(f.ast, func(n ast.Node) bool {
						switch x := n.(type) {
						case *ast.CompositeLit:
							if selectorOf(x.Type) == httpName+".Client" && !hasKey(x, "Timeout") {
								out = append(out, finding{f.rel, p.line(x), "`http.Client{}` sans `Timeout`"})
							}
						case *ast.SelectorExpr:
							if selectorOf(x) == httpName+".DefaultClient" {
								out = append(out, finding{f.rel, p.line(x), "`http.DefaultClient`"})
							}
						case *ast.CallExpr:
							switch selectorOf(x.Fun) {
							case httpName + ".Get", httpName + ".Post", httpName + ".Head", httpName + ".PostForm":
								out = append(out, finding{f.rel, p.line(x), fmt.Sprintf("`%s(…)` utilise le client par défaut", selectorOf(x.Fun))})
							}
						}
						return true
					})
				}
				return out
			},
		},
		{
			id: "B-SEC-02", rule: ruleSecurity, sev: sevError,
			run: func(p *project) []finding {
				var out []finding
				for _, f := range p.files {
					if f.rel != "main.go" {
						continue
					}
					httpName := f.imports["net/http"]
					ast.Inspect(f.ast, func(n ast.Node) bool {
						switch x := n.(type) {
						case *ast.CompositeLit:
							if httpName != "" && selectorOf(x.Type) == httpName+".Server" {
								var missing []string
								for _, key := range []string{"ReadHeaderTimeout", "ReadTimeout", "WriteTimeout", "IdleTimeout"} {
									if !hasKey(x, key) {
										missing = append(missing, "`"+key+"`")
									}
								}
								if len(missing) > 0 {
									out = append(out, finding{f.rel, p.line(x), "`http.Server` sans " + strings.Join(missing, ", ")})
								}
							}
						case *ast.CallExpr:
							if sel, ok := x.Fun.(*ast.SelectorExpr); ok && sel.Sel.Name == "Run" {
								out = append(out, finding{f.rel, p.line(x), fmt.Sprintf("`%s.Run(…)` n'a pas de timeout", exprName(sel.X))})
							}
						}
						return true
					})
				}
				return out
			},
		},
		{
			id: "B-SEC-03", rule: ruleSecurity, sev: sevError,
			run: func(p *project) []finding {
				return callFindings(p, p.files, func(f *goFile, call *ast.CallExpr, sel *ast.SelectorExpr) string {
					if selectorOf(sel) == f.imports["github.com/gin-gonic/gin"]+".Default" {
						return "`gin.Default()`"
					}
					return ""
				})
			},
		},
		{
			id: "B-GO-01", rule: ruleArchitecture, sev: sevError,
			run: func(p *project) []finding {
				var out []finding
				for _, f := range p.files {
					ast.Inspect(f.ast, func(n ast.Node) bool {
						if id, ok := n.(*ast.Ident); ok && regexp.MustCompile(`^uint(8|16|32|64|ptr)?$`).MatchString(id.Name) {
							out = append(out, finding{f.rel, p.line(id), fmt.Sprintf("type `%s` utilisé", id.Name)})
						}
						return true
					})
				}
				return out
			},
		},
		{
			id: "B-GO-02", rule: ruleArchitecture, sev: sevWarn,
			run: func(p *project) []finding {
				var out []finding
				for _, f := range p.files {
					ctxName, ok := f.imports["context"]
					if !ok {
						continue
					}
					for _, fn := range funcs(f) {
						pos := 0
						for _, field := range fn.Type.Params.List {
							if selectorOf(field.Type) == ctxName+".Context" && pos > 0 {
								out = append(out, finding{f.rel, p.line(fn), fmt.Sprintf("`%s` prend le contexte en position %d", fn.Name.Name, pos+1)})
							}
							pos += max(1, len(field.Names))
						}
					}
				}
				return out
			},
		},
		{
			id: "B-GO-03", rule: ruleArchitecture, sev: sevInfo,
			run: func(p *project) []finding {
				var out []finding
				for _, f := range p.files {
					for _, fn := range funcs(f) {
						if !ast.IsExported(fn.Name.Name) || (fn.Recv != nil && !ast.IsExported(receiverType(fn))) {
							continue
						}
						if fn.Doc == nil || !strings.HasPrefix(fn.Doc.Text(), fn.Name.Name+" ") {
							out = append(out, finding{f.rel, p.line(fn), fmt.Sprintf("`%s` n'a pas de commentaire de documentation", fn.Name.Name)})
						}
					}
				}
				return out
			},
		},
		{
			id: "B-GO-04", rule: ruleArchitecture, sev: sevWarn,
			run: func(p *project) []finding {
				var out []finding
				for _, f := range p.files {
					for _, group := range f.ast.Comments {
						for _, c := range group.List {
							if commentedCode.MatchString(c.Text) && !strings.Contains(c.Text, "audit-ignore") {
								out = append(out, finding{f.rel, p.line(c), fmt.Sprintf("`%s`", strings.TrimSpace(c.Text))})
							}
						}
					}
				}
				return out
			},
		},
		{
			id: "B-LOG-01", rule: ruleLogging, sev: sevWarn,
			run: func(p *project) []finding {
				var out []finding
				for _, f := range p.under("controllers/", "services/", "application/", "middleware/", "infrastructure/") {
					for imp, line := range f.importLines {
						if imp == "log" || imp == "github.com/sirupsen/logrus" {
							out = append(out, finding{f.rel, line, fmt.Sprintf("imports `%s`", imp)})
						}
					}
				}
				return out
			},
		},
		{
			id: "B-LOG-02", rule: ruleLogging, sev: sevWarn,
			run: func(p *project) []finding {
				var out []finding
				check := func(files []*goFile, wrong string) {
					for _, f := range files {
						helpers := f.imports[p.module+"/commons/helpers"]
						ast.Inspect(f.ast, func(n ast.Node) bool {
							if sel, ok := n.(*ast.SelectorExpr); ok && helpers != "" && selectorOf(sel) == helpers+"."+wrong {
								out = append(out, finding{f.rel, p.line(sel), fmt.Sprintf("`helpers.%s`", wrong)})
							}
							return true
						})
					}
				}
				check(p.under("controllers/"), "SRCLogger")
				check(p.under("services/", "application/"), "CTRLogger")
				return out
			},
		},
		{
			id: "B-CFG-01", rule: ruleConfig, sev: sevWarn,
			run: func(p *project) []finding {
				var out []finding
				for _, f := range p.files {
					if strings.HasPrefix(f.rel, "config/") {
						continue
					}
					for _, key := range envReads(p, f) {
						out = append(out, finding{f.rel, key.line, fmt.Sprintf("`%s(\"%s\")`", key.via, key.name)})
					}
				}
				return out
			},
		},
		{
			id: "B-CFG-02", rule: ruleConfig, sev: sevWarn,
			run: func(p *project) []finding {
				src, err := os.ReadFile(filepath.Join(p.root, "config", ".example.env"))
				if err != nil {
					return []finding{{"config/.example.env", 0, "fichier absent"}}
				}
				declared := map[string]int{}
				for i, line := range strings.Split(string(src), "\n") {
					if m := regexp.MustCompile(`^\s*([A-Z][A-Z0-9_]*)=`).FindStringSubmatch(line); m != nil {
						declared[m[1]] = i + 1
					}
				}
				read := map[string]bool{}
				var out []finding
				for _, f := range p.files {
					for _, key := range envReads(p, f) {
						read[key.name] = true
						if _, ok := declared[key.name]; !ok {
							out = append(out, finding{f.rel, key.line, fmt.Sprintf("`%s` est lue mais absente de `.example.env`", key.name)})
						}
					}
				}
				var unread []string
				for key := range declared {
					if !read[key] {
						unread = append(unread, key)
					}
				}
				sort.Strings(unread)
				for _, key := range unread {
					out = append(out, finding{"config/.example.env", declared[key], fmt.Sprintf("`%s` n'est lue nulle part dans le code (une bibliothèque peut la lire : vérifier avant de la retirer)", key)})
				}
				return out
			},
		},
	}
}

func hasKey(lit *ast.CompositeLit, key string) bool {
	for _, elt := range lit.Elts {
		if kv, ok := elt.(*ast.KeyValueExpr); ok {
			if id, ok := kv.Key.(*ast.Ident); ok && id.Name == key {
				return true
			}
		}
	}
	return false
}

type envRead struct {
	name, via string
	line      int
}

// envReads lists literal env keys read with os.Getenv / os.LookupEnv / viper.Get*.
func envReads(p *project, f *goFile) []envRead {
	osName, hasOS := f.imports["os"]
	viperName, hasViper := f.imports["github.com/spf13/viper"]
	if !hasOS && !hasViper {
		return nil
	}
	var out []envRead
	ast.Inspect(f.ast, func(n ast.Node) bool {
		call, ok := n.(*ast.CallExpr)
		if !ok || len(call.Args) == 0 {
			return true
		}
		name := selectorOf(call.Fun)
		pkg, fn, _ := strings.Cut(name, ".")
		isEnv := (hasOS && pkg == osName && (fn == "Getenv" || fn == "LookupEnv")) ||
			(hasViper && pkg == viperName && (strings.HasPrefix(fn, "Get") || fn == "BindEnv" || fn == "IsSet"))
		if !isEnv {
			return true
		}
		if lit, ok := call.Args[0].(*ast.BasicLit); ok {
			if key, err := strconv.Unquote(lit.Value); err == nil {
				out = append(out, envRead{key, name, p.line(call)})
			}
		}
		return true
	})
	return out
}

func toolChecks() []check {
	return []check{
		{
			id: "B-TOOL-01", rule: ruleArchitecture, sev: sevError,
			run: func(p *project) []finding {
				var out []finding
				for _, f := range p.files {
					formatted, err := format.Source(f.src)
					if err == nil && !bytes.Equal(formatted, f.src) {
						out = append(out, finding{f.rel, 0, "pas formaté avec gofmt"})
					}
				}
				return out
			},
		},
		{
			id: "B-TOOL-02", rule: ruleNoGoTest, sev: sevError,
			run: func(p *project) []finding {
				var out []finding
				lineRe := regexp.MustCompile(`^(?:vet: )?(?:\./)?(\S+\.go):(\d+)(?::\d+)?: (.*)$`)
				for _, args := range [][]string{{"build", "./..."}, {"vet", "./..."}} {
					cmd := exec.Command("go", args...)
					cmd.Dir = p.root
					output, err := cmd.CombinedOutput()
					if err == nil {
						continue
					}
					parsed := false
					for _, line := range strings.Split(string(output), "\n") {
						if m := lineRe.FindStringSubmatch(strings.TrimSpace(line)); m != nil {
							n, _ := strconv.Atoi(m[2])
							out = append(out, finding{m[1], n, fmt.Sprintf("`go %s`: %s", args[0], m[3])})
							parsed = true
						}
					}
					if !parsed {
						out = append(out, finding{"", 0, fmt.Sprintf("`go %s ./...` a échoué : %s", args[0], strings.TrimSpace(string(output)))})
					}
				}
				return out
			},
		},
	}
}
