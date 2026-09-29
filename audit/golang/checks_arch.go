package main

import (
	"fmt"
	"go/ast"
	"sort"
	"strings"
)

const (
	ruleServices     = "stack/service-rules/services-auto.md"
	rulePure         = "stack/service-rules/pure-subpackages.md"
	ruleApplication  = "stack/core-rules/application-layer.md"
	ruleAPI          = "stack/api-rules/api-auto.md"
	ruleArchitecture = "stack/core-rules/project-architecture-always.md"
)

// isPureDir: a subpackage services/<domain>/<sub>/… with no mapper and no API client is a pure one.
func (p *project) isPureDir(dir string) bool {
	if !strings.HasPrefix(dir, "services/") || strings.Count(dir, "/") < 2 {
		return false
	}
	for _, f := range p.byDir[dir] {
		if strings.HasSuffix(f.rel, "_mapper.go") || hasSuffixAny(f.rel, "/client.go", "/authctx.go", "/http_client.go") {
			return false
		}
	}
	return true
}

// isClientDir: an external API client package, or a resource package below one.
func (p *project) isClientDir(dir string) bool {
	for d := dir; strings.HasPrefix(d, "services/"); d = pathDir(d) {
		for _, f := range p.byDir[d] {
			if hasSuffixAny(f.rel, "/client.go", "/authctx.go", "/http_client.go") {
				return true
			}
		}
	}
	return false
}

func archChecks() []check {
	return []check{
		{
			id: "B-ARCH-01", rule: ruleServices, sev: sevError,
			run: func(p *project) []finding {
				var out []finding
				for _, f := range p.under("services/") {
					own := segment(f.rel, 1)
					for imp, line := range f.importLines {
						rel := p.localImport(imp)
						if strings.HasPrefix(rel, "services/") && segment(rel, 1) != own {
							out = append(out, finding{f.rel, line, fmt.Sprintf("`services/%s` importe `%s`", own, rel)})
						}
					}
				}
				return out
			},
		},
		{
			id: "B-ARCH-02", rule: ruleAPI, sev: sevError,
			run: func(p *project) []finding {
				var out []finding
				for _, f := range p.under("controllers/v1/") {
					own := segment(f.rel, 2)
					for imp, line := range f.importLines {
						rel := p.localImport(imp)
						if strings.HasPrefix(rel, "controllers/v1/") && segment(rel, 2) != own {
							out = append(out, finding{f.rel, line, fmt.Sprintf("la racine `%s` importe `%s`", own, rel)})
						}
					}
				}
				return out
			},
		},
		{
			id: "B-ARCH-03", rule: ruleApplication, sev: sevError,
			run: func(p *project) []finding {
				var out []finding
				for _, f := range p.under("application/") {
					for imp, line := range f.importLines {
						if imp == "github.com/gin-gonic/gin" || strings.HasPrefix(imp, "gorm.io/") || p.localImport(imp) == "database/model" {
							out = append(out, finding{f.rel, line, fmt.Sprintf("importe `%s`", imp)})
						}
					}
					dbName, ok := f.imports[p.module+"/database"]
					if !ok {
						continue
					}
					ast.Inspect(f.ast, func(n ast.Node) bool {
						if sel, ok := n.(*ast.SelectorExpr); ok {
							if id, ok := sel.X.(*ast.Ident); ok && id.Name == dbName && sel.Sel.Name != "RunInTx" {
								out = append(out, finding{f.rel, p.line(sel), fmt.Sprintf("utilise `database.%s`", sel.Sel.Name)})
							}
						}
						return true
					})
				}
				return out
			},
		},
		{
			id: "B-ARCH-04", rule: rulePure, sev: sevError,
			run: func(p *project) []finding {
				var out []finding
				for _, f := range p.under("services/") {
					if !p.isPureDir(f.dir) || p.isClientDir(f.dir) {
						continue
					}
					own := segment(f.rel, 1)
					for imp, line := range f.importLines {
						rel := p.localImport(imp)
						bad := strings.HasPrefix(imp, "gorm.io/") || imp == "net/http" || strings.HasPrefix(rel, "database") ||
							(strings.HasPrefix(rel, "services/") && segment(rel, 1) != own)
						if bad {
							out = append(out, finding{f.rel, line, fmt.Sprintf("le package pur `%s` importe `%s`", f.dir, imp)})
						}
					}
				}
				return out
			},
		},
		{
			id: "B-ARCH-05", rule: ruleAPI, sev: sevError,
			run: func(p *project) []finding {
				var out []finding
				// controllers/health is left out: its readiness probe pings the database on purpose.
				for _, f := range p.under("controllers/v1/") {
					for imp, line := range f.importLines {
						rel := p.localImport(imp)
						if strings.HasPrefix(imp, "gorm.io/") || rel == "database" || rel == "database/model" {
							out = append(out, finding{f.rel, line, fmt.Sprintf("importe `%s`", imp)})
						}
					}
				}
				return out
			},
		},
	}
}

func typeChecks() []check {
	return []check{
		{
			id: "B-TYPE-01", rule: "stack/database-rules/database-auto.md", sev: sevError,
			run: func(p *project) []finding {
				return tagFindings(p, p.under("database/model/"), func(key string) bool { return key != "gorm" }, "modèle")
			},
		},
		{
			id: "B-TYPE-02", rule: ruleServices, sev: sevError,
			run: func(p *project) []finding {
				var files []*goFile
				for _, f := range p.files {
					if strings.HasSuffix(f.rel, "_domain.go") {
						files = append(files, f)
					}
				}
				return tagFindings(p, files, func(string) bool { return true }, "domain")
			},
		},
		{
			id: "B-TYPE-03", rule: ruleAPI, sev: sevError,
			run: func(p *project) []finding {
				var files []*goFile
				for _, f := range p.under("controllers/") {
					if hasSuffixAny(f.rel, "_dto.go", "_request.go") {
						files = append(files, f)
					}
				}
				return tagFindings(p, files, func(key string) bool { return key == "gorm" }, "DTO/requête")
			},
		},
		{
			id: "B-TYPE-04", rule: ruleServices, sev: sevError,
			run: func(p *project) []finding {
				var out []finding
				for _, files := range p.byDir {
					dataTypes := map[string]string{}
					for _, f := range files {
						if hasSuffixAny(f.rel, "_domain.go", "_dto.go", "_request.go") {
							eachStruct(f, func(name string, _ *ast.TypeSpec, _ *ast.StructType) { dataTypes[name] = f.rel })
						}
					}
					if len(dataTypes) == 0 {
						continue
					}
					for _, f := range files {
						for _, fn := range funcs(f) {
							if declared, ok := dataTypes[receiverType(fn)]; ok {
								out = append(out, finding{f.rel, p.line(fn), fmt.Sprintf("méthode `%s.%s` sur un type de données déclaré dans `%s`", receiverType(fn), fn.Name.Name, declared)})
							}
						}
					}
				}
				return out
			},
		},
		{
			id: "B-TYPE-05", rule: ruleAPI, sev: sevWarn,
			run: func(p *project) []finding {
				var out []finding
				for _, f := range p.under("controllers/") {
					if !strings.HasSuffix(f.rel, "_dto.go") {
						continue
					}
					eachStruct(f, func(name string, spec *ast.TypeSpec, _ *ast.StructType) {
						if !strings.HasSuffix(name, "Dto") {
							out = append(out, finding{f.rel, p.line(spec), fmt.Sprintf("`%s` ne finit pas par Dto", name)})
						}
					})
				}
				return out
			},
		},
		{
			id: "B-FILE-01", rule: ruleServices, sev: sevWarn,
			run: func(p *project) []finding {
				var out []finding
				for _, dir := range sortedDirs(p, "services/") {
					if p.isPureDir(dir) || p.isClientDir(dir) {
						continue
					}
					var hasDomain, hasMapper, hasMain bool
					for _, f := range p.byDir[dir] {
						switch {
						case strings.HasSuffix(f.rel, "_domain.go"):
							hasDomain = true
						case strings.HasSuffix(f.rel, "_mapper.go"):
							hasMapper = true
						default:
							hasMain = true
						}
					}
					var missing []string
					if !hasDomain {
						missing = append(missing, "`*_domain.go`")
					}
					if !hasMapper {
						missing = append(missing, "`*_mapper.go`")
					}
					if !hasMain {
						missing = append(missing, "le fichier service `.go`")
					}
					if len(missing) > 0 {
						out = append(out, finding{p.byDir[dir][0].rel, 0, fmt.Sprintf("il manque à `%s` : %s", dir, strings.Join(missing, ", "))})
					}
				}
				return out
			},
		},
		{
			id: "B-FILE-02", rule: ruleAPI, sev: sevWarn,
			run: func(p *project) []finding {
				var out []finding
				for _, dir := range sortedDirs(p, "controllers/v1/") {
					var hasDto, hasMapper, hasHandler bool
					for _, f := range p.byDir[dir] {
						switch {
						case strings.HasSuffix(f.rel, "_dto.go"):
							hasDto = true
						case strings.HasSuffix(f.rel, "_mapper.go"):
							hasMapper = true
						case !strings.HasSuffix(f.rel, "_request.go"):
							hasHandler = true
						}
					}
					if !hasDto || !hasMapper || !hasHandler {
						out = append(out, finding{p.byDir[dir][0].rel, 0, fmt.Sprintf("`%s` — dto %s, mapper %s, handler %s", dir, yesNo(hasDto), yesNo(hasMapper), yesNo(hasHandler))})
					}
				}
				return out
			},
		},
		{
			id: "B-FILE-03", rule: ruleArchitecture, sev: sevError,
			run: func(p *project) []finding {
				var out []finding
				for _, f := range p.files {
					name := f.rel[strings.LastIndex(f.rel, "/")+1:]
					if strings.ToLower(name) != name || strings.Contains(name, "-") {
						out = append(out, finding{f.rel, 0, fmt.Sprintf("`%s` n'est pas en snake_case", name)})
					}
				}
				return out
			},
		},
	}
}

func tagFindings(p *project, files []*goFile, forbidden func(key string) bool, what string) []finding {
	var out []finding
	for _, f := range files {
		eachStruct(f, func(name string, _ *ast.TypeSpec, st *ast.StructType) {
			for _, field := range st.Fields.List {
				var bad []string
				for _, key := range tagKeys(field.Tag) {
					if forbidden(key) {
						bad = append(bad, key)
					}
				}
				if len(bad) > 0 {
					fieldName := "(intégré)"
					if len(field.Names) > 0 {
						fieldName = field.Names[0].Name
					}
					out = append(out, finding{f.rel, p.line(field), fmt.Sprintf("%s `%s.%s` : tag(s) `%s`", what, name, fieldName, strings.Join(bad, "`, `"))})
				}
			}
		})
	}
	return out
}

func sortedDirs(p *project, prefix string) []string {
	var dirs []string
	for dir := range p.byDir {
		if strings.HasPrefix(dir+"/", prefix) && dir+"/" != prefix {
			dirs = append(dirs, dir)
		}
	}
	sort.Strings(dirs)
	return dirs
}

func yesNo(b bool) string {
	if b {
		return "oui"
	}
	return "non"
}
