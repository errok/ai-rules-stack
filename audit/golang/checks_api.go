package main

import (
	"fmt"
	"go/ast"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

const (
	ruleComposition = "stack/api-rules/controller-initialization-order.md"
	ruleMethodNames = "stack/core-rules/method-naming.md"
)

var serverErrorStatuses = map[string]bool{
	"StatusInternalServerError": true, "StatusNotImplemented": true, "StatusBadGateway": true,
	"StatusServiceUnavailable": true, "StatusGatewayTimeout": true,
}

func apiChecks() []check {
	return []check{
		{
			id: "B-API-01", rule: ruleAPI, sev: sevError,
			run: func(p *project) []finding {
				return callFindings(p, p.under("controllers/", "middleware/"), func(f *goFile, call *ast.CallExpr, sel *ast.SelectorExpr) string {
					switch sel.Sel.Name {
					case "AbortWithError", "JSON", "String", "AbortWithStatusJSON", "ResponseJSON", "IndentedJSON":
					default:
						return ""
					}
					serverError, leaks := false, false
					for _, arg := range call.Args {
						ast.Inspect(arg, func(n ast.Node) bool {
							switch x := n.(type) {
							case *ast.SelectorExpr:
								if serverErrorStatuses[x.Sel.Name] {
									serverError = true
								}
							case *ast.BasicLit:
								if strings.HasPrefix(x.Value, "5") && len(x.Value) == 3 {
									serverError = true
								}
							case *ast.CallExpr:
								if s, ok := x.Fun.(*ast.SelectorExpr); ok && s.Sel.Name == "Error" && len(x.Args) == 0 {
									leaks = true
								}
							}
							return true
						})
					}
					if serverError && leaks {
						return "réponse 5xx construite avec `err.Error()`"
					}
					return ""
				})
			},
		},
		{
			id: "B-API-02", rule: ruleAPI, sev: sevError,
			run: func(p *project) []finding {
				var out []finding
				for _, f := range p.under("controllers/") {
					if strings.HasSuffix(f.rel, "_mapper.go") {
						continue
					}
					ast.Inspect(f.ast, func(n ast.Node) bool {
						lit, ok := n.(*ast.CompositeLit)
						if !ok {
							return true
						}
						t := lit.Type
						if arr, ok := t.(*ast.ArrayType); ok {
							t = arr.Elt
						}
						if id, ok := t.(*ast.Ident); ok && strings.HasSuffix(id.Name, "Dto") {
							out = append(out, finding{f.rel, p.line(lit), fmt.Sprintf("littéral `%s{…}`", id.Name)})
						}
						return true
					})
				}
				return out
			},
		},
		{
			id: "B-API-03", rule: ruleAPI, sev: sevWarn,
			run: func(p *project) []finding {
				var out []finding
				for _, f := range p.under("controllers/") {
					for _, fn := range funcs(f) {
						recv := receiverName(fn)
						if !isGinHandler(f, fn) || recv == "" || fn.Body == nil {
							continue
						}
						used := map[string]bool{}
						ast.Inspect(fn.Body, func(n ast.Node) bool {
							call, ok := n.(*ast.CallExpr)
							if !ok {
								return true
							}
							if sel, ok := call.Fun.(*ast.SelectorExpr); ok {
								if field, ok := sel.X.(*ast.SelectorExpr); ok {
									if id, ok := field.X.(*ast.Ident); ok && id.Name == recv {
										used[field.Sel.Name] = true
									}
								}
							}
							return true
						})
						if len(used) > 1 {
							names := make([]string, 0, len(used))
							for name := range used {
								names = append(names, "`"+name+"`")
							}
							sort.Strings(names)
							out = append(out, finding{f.rel, p.line(fn), fmt.Sprintf("`%s` appelle %s", fn.Name.Name, strings.Join(names, ", "))})
						}
					}
				}
				return out
			},
		},
		{
			id: "B-API-04", rule: ruleComposition, sev: sevError,
			run: func(p *project) []finding {
				var out []finding
				for _, f := range p.under("controllers/") {
					for _, decl := range f.ast.Decls {
						if gen, ok := decl.(*ast.GenDecl); ok && gen.Tok.String() == "var" {
							for _, spec := range gen.Specs {
								for _, value := range spec.(*ast.ValueSpec).Values {
									if _, ok := value.(*ast.CallExpr); ok {
										out = append(out, finding{f.rel, p.line(value), "`var` de package initialisée par un appel (exécutée avant la connexion à la base)"})
									}
								}
							}
						}
					}
					for _, fn := range funcs(f) {
						if !isGinHandler(f, fn) || fn.Body == nil {
							continue
						}
						ast.Inspect(fn.Body, func(n ast.Node) bool {
							call, ok := n.(*ast.CallExpr)
							if !ok {
								return true
							}
							name := selectorOf(call.Fun)
							if name == "" {
								return true
							}
							pkg, fnName, _ := strings.Cut(name, ".")
							if !strings.HasPrefix(fnName, "New") && !strings.HasPrefix(fnName, "Default") {
								return true
							}
							for imp, alias := range f.imports {
								rel := p.localImport(imp)
								if alias == pkg && (strings.HasPrefix(rel, "services/") || strings.HasPrefix(rel, "application/")) {
									out = append(out, finding{f.rel, p.line(call), fmt.Sprintf("`%s()` dans le handler `%s`", name, fn.Name.Name)})
								}
							}
							return true
						})
					}
				}
				return out
			},
		},
		{
			id: "B-API-05", rule: ruleAPI, sev: sevWarn,
			run: func(p *project) []finding {
				var out []finding
				aliasRe := regexp.MustCompile(`^srv[A-Z]\w*$`)
				for _, f := range p.under("controllers/") {
					for imp, alias := range f.imports {
						rel := p.localImport(imp)
						if strings.HasPrefix(rel, "services/") && strings.Count(rel, "/") == 1 && !aliasRe.MatchString(alias) {
							out = append(out, finding{f.rel, f.importLines[imp], fmt.Sprintf("`%s` importé en `%s`", rel, alias)})
						}
					}
				}
				return out
			},
		},
		{
			id: "B-API-06", rule: ruleAPI, sev: sevWarn,
			run: func(p *project) []finding {
				src, err := os.ReadFile(filepath.Join(p.root, "router", "router.go"))
				if err != nil {
					return nil
				}
				re := regexp.MustCompile(`\w+\s*:=\s*v1route\.Group\("([^"]*)"\)`)
				var out []finding
				seen := map[string]bool{}
				prev := ""
				for i, line := range strings.Split(string(src), "\n") {
					m := re.FindStringSubmatch(line)
					if m == nil {
						continue
					}
					if seen[m[1]] {
						out = append(out, finding{"router/router.go", i + 1, fmt.Sprintf("groupe `%s` déclaré deux fois", m[1])})
					}
					if prev != "" && m[1] < prev {
						out = append(out, finding{"router/router.go", i + 1, fmt.Sprintf("`%s` arrive après `%s`", m[1], prev)})
					}
					seen[m[1]] = true
					prev = m[1]
				}
				return out
			},
		},
		{
			id: "B-API-07", rule: ruleMethodNames, sev: sevWarn,
			run: func(p *project) []finding {
				httpVerb := regexp.MustCompile(`^(GET|POST|PUT|PATCH|DELETE)[A-Za-z]`)
				offList := regexp.MustCompile(`^(List|Find|Fetch|Add|Remove|Save|Insert|Edit|Modify|Upsert)([A-Z]|$)|^Get(By|All)([A-Z]|$)`)
				var out []finding
				for _, f := range p.under("controllers/", "application/", "services/") {
					if hasSuffixAny(f.rel, "_domain.go", "_dto.go", "_request.go", "_mapper.go") {
						continue
					}
					for _, fn := range funcs(f) {
						name := fn.Name.Name
						if fn.Recv == nil || !ast.IsExported(name) {
							continue
						}
						if httpVerb.MatchString(name) || offList.MatchString(name) {
							out = append(out, finding{f.rel, p.line(fn), fmt.Sprintf("`%s.%s` ne commence pas par un verbe CRUD", receiverType(fn), name)})
						}
					}
				}
				return out
			},
		},
	}
}
