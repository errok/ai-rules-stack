package main

import (
	"fmt"
	"go/ast"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"unicode"
)

const (
	ruleDatabase     = "stack/database-rules/database-auto.md"
	ruleAssociations = "stack/database-rules/gorm-model-associations.md"
	ruleTableNaming  = "stack/database-rules/table-naming.md"
)

type sqlForeignKey struct {
	table, column, refSchema, refTable string
}

// readForeignKeys lists `FOREIGN KEY (col) REFERENCES schema.table` from database/tables/*.sql and init.sql.
func readForeignKeys(root string) []sqlForeignKey {
	files, _ := filepath.Glob(filepath.Join(root, "database", "tables", "*.sql"))
	files = append(files, filepath.Join(root, "database", "init.sql"))
	createRe := regexp.MustCompile(`(?i)CREATE TABLE (?:IF NOT EXISTS )?(?:(\w+)\.)?(\w+)`)
	fkRe := regexp.MustCompile(`(?i)FOREIGN KEY \((\w+)\) REFERENCES (?:(\w+)\.)?(\w+)`)
	inlineRe := regexp.MustCompile(`(?i)^\s*(\w+)\s+[^,]*?\bREFERENCES (?:(\w+)\.)?(\w+)`)
	var out []sqlForeignKey
	for _, path := range files {
		src, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		table := ""
		for _, line := range strings.Split(string(src), "\n") {
			if strings.HasPrefix(strings.TrimSpace(line), "--") {
				continue
			}
			if m := createRe.FindStringSubmatch(line); m != nil {
				table = m[2]
			}
			if table == "" {
				continue
			}
			if m := fkRe.FindStringSubmatch(line); m != nil {
				out = append(out, sqlForeignKey{table, m[1], m[2], m[3]})
			} else if m := inlineRe.FindStringSubmatch(line); m != nil && !strings.EqualFold(m[1], "CONSTRAINT") {
				out = append(out, sqlForeignKey{table, m[1], m[2], m[3]})
			}
		}
	}
	return out
}

type modelInfo struct {
	file  *goFile
	name  string
	table string
	st    *ast.StructType
}

// readModels maps each database/model struct to its TableName() literal.
func readModels(p *project) map[string]modelInfo {
	tables := map[string]string{} // struct name → table
	for _, f := range p.under("database/model/") {
		for _, fn := range funcs(f) {
			if fn.Name.Name != "TableName" || fn.Body == nil {
				continue
			}
			ast.Inspect(fn.Body, func(n ast.Node) bool {
				if ret, ok := n.(*ast.ReturnStmt); ok && len(ret.Results) == 1 {
					if lit, ok := ret.Results[0].(*ast.BasicLit); ok {
						table, _ := strconv.Unquote(lit.Value)
						tables[receiverType(fn)] = table
					}
				}
				return true
			})
		}
	}
	models := map[string]modelInfo{}
	for _, f := range p.under("database/model/") {
		eachStruct(f, func(name string, _ *ast.TypeSpec, st *ast.StructType) {
			if table, ok := tables[name]; ok {
				short := table[strings.LastIndex(table, ".")+1:]
				models[short] = modelInfo{f, name, table, st}
			}
		})
	}
	return models
}

// gormColumn mirrors GORM's default naming: `SessionTypeID` → `session_type_id`.
func gormColumn(field string, tag string) string {
	if m := regexp.MustCompile(`column:(\w+)`).FindStringSubmatch(tag); m != nil {
		return m[1]
	}
	runes := []rune(field)
	var b strings.Builder
	for i, r := range runes {
		if unicode.IsUpper(r) && i > 0 {
			prevLower := unicode.IsLower(runes[i-1]) || unicode.IsDigit(runes[i-1])
			nextLower := i+1 < len(runes) && unicode.IsLower(runes[i+1])
			if prevLower || (nextLower && unicode.IsUpper(runes[i-1])) {
				b.WriteByte('_')
			}
		}
		b.WriteRune(unicode.ToLower(r))
	}
	return b.String()
}

func dbChecks() []check {
	return []check{
		{
			id: "B-DB-01", rule: ruleAssociations, sev: sevError,
			run: func(p *project) []finding {
				models := readModels(p)
				var out []finding
				fks := readForeignKeys(p.root)
				sort.Slice(fks, func(i, j int) bool { return fks[i].table+fks[i].column < fks[j].table+fks[j].column })
				for _, fk := range fks {
					model, ok := models[fk.table]
					if !ok {
						continue
					}
					if _, local := models[fk.refTable]; !local && fk.refSchema != "" && fk.refSchema != "public" {
						continue
					}
					var column *ast.Field
					related := false
					for _, field := range model.st.Fields.List {
						if len(field.Names) == 0 {
							continue
						}
						name := field.Names[0].Name
						tag := tagValue(field.Tag, "gorm")
						if gormColumn(name, tag) == fk.column {
							column = field
						}
						if strings.Contains(tag, "foreignKey:") && !isSlice(field.Type) && strings.EqualFold(gormColumn(foreignKeyOf(tag), ""), fk.column) {
							related = true
						}
					}
					switch {
					case column == nil:
						out = append(out, finding{model.file.rel, p.line(model.st), fmt.Sprintf("`%s.%s` référence `%s` mais `%s` n'a pas de champ pour cette colonne", fk.table, fk.column, fk.refTable, model.name)})
					case !related:
						out = append(out, finding{model.file.rel, p.line(column), fmt.Sprintf("`%s.%s` → `%s` n'a pas de champ d'association", model.name, column.Names[0].Name, fk.refTable)})
					}
				}
				return out
			},
		},
		{
			id: "B-DB-02", rule: ruleAssociations, sev: sevWarn,
			run: func(p *project) []finding {
				var out []finding
				for _, f := range p.under("database/model/") {
					eachStruct(f, func(name string, _ *ast.TypeSpec, st *ast.StructType) {
						for _, field := range st.Fields.List {
							tag := tagValue(field.Tag, "gorm")
							if !strings.Contains(tag, "foreignKey:") || len(field.Names) == 0 {
								continue
							}
							if _, ok := field.Type.(*ast.StarExpr); !ok && !isSlice(field.Type) {
								out = append(out, finding{f.rel, p.line(field), fmt.Sprintf("`%s.%s` est une association par valeur", name, field.Names[0].Name)})
							}
						}
					})
				}
				return out
			},
		},
		{
			id: "B-DB-03", rule: ruleTableNaming, sev: sevWarn,
			run: func(p *project) []finding {
				var out []finding
				for _, m := range readModels(p) {
					short := m.table[strings.LastIndex(m.table, ".")+1:]
					if strings.HasSuffix(short, "s") && !hasSuffixAny(short, "ss", "us", "is", "status") {
						out = append(out, finding{m.file.rel, 0, fmt.Sprintf("table `%s` au pluriel", m.table)})
					}
				}
				return out
			},
		},
		{
			id: "B-DB-04", rule: ruleAssociations, sev: sevInfo,
			run: func(p *project) []finding {
				var out []finding
				for _, f := range p.under("database/model/") {
					for _, group := range f.ast.Comments {
						text := strings.TrimSpace(group.Text())
						if text != "" && !strings.HasPrefix(group.List[0].Text, "//go:") {
							out = append(out, finding{f.rel, p.line(group), fmt.Sprintf("commentaire : « %s »", firstLine(text))})
						}
					}
				}
				return out
			},
		},
		{
			id: "B-DB-05", rule: ruleDatabase, sev: sevError,
			run: func(p *project) []finding {
				return callFindings(p, p.files, func(f *goFile, call *ast.CallExpr, sel *ast.SelectorExpr) string {
					if sel.Sel.Name == "AutoMigrate" {
						return "appel à `AutoMigrate`"
					}
					return ""
				})
			},
		},
		{
			id: "B-DB-06", rule: ruleServices, sev: sevError,
			run: func(p *project) []finding {
				return callFindings(p, p.under("services/", "application/"), func(f *goFile, call *ast.CallExpr, sel *ast.SelectorExpr) string {
					if inner, ok := sel.X.(*ast.SelectorExpr); ok && inner.Sel.Name == "db" {
						return fmt.Sprintf("requête sur `%s.db.%s(…)`", exprName(inner.X), sel.Sel.Name)
					}
					if sel.Sel.Name == "WithContext" {
						return "`WithContext` — utiliser `database.FromContext(ctx, s.db)`"
					}
					return ""
				})
			},
		},
		{
			id: "B-DB-07", rule: ruleDatabase, sev: sevError,
			run: func(p *project) []finding {
				return callFindings(p, p.under("services/", "application/", "controllers/"), func(f *goFile, call *ast.CallExpr, sel *ast.SelectorExpr) string {
					if sel.Sel.Name == "Debug" && len(call.Args) == 0 {
						return "`.Debug()`"
					}
					return ""
				})
			},
		},
	}
}

func isSlice(expr ast.Expr) bool {
	_, ok := expr.(*ast.ArrayType)
	return ok
}

func foreignKeyOf(tag string) string {
	m := regexp.MustCompile(`foreignKey:(\w+)`).FindStringSubmatch(tag)
	if m == nil {
		return ""
	}
	return m[1]
}

func firstLine(s string) string {
	if i := strings.Index(s, "\n"); i >= 0 {
		return s[:i] + " …"
	}
	return s
}

func exprName(expr ast.Expr) string {
	switch e := expr.(type) {
	case *ast.Ident:
		return e.Name
	case *ast.SelectorExpr:
		return exprName(e.X) + "." + e.Sel.Name
	}
	return "…"
}

// callFindings runs match on every method-style call (`x.Name(...)`) of the files.
func callFindings(p *project, files []*goFile, match func(f *goFile, call *ast.CallExpr, sel *ast.SelectorExpr) string) []finding {
	var out []finding
	for _, f := range files {
		ast.Inspect(f.ast, func(n ast.Node) bool {
			call, ok := n.(*ast.CallExpr)
			if !ok {
				return true
			}
			if sel, ok := call.Fun.(*ast.SelectorExpr); ok {
				if msg := match(f, call, sel); msg != "" {
					out = append(out, finding{f.rel, p.line(call), msg})
				}
			}
			return true
		})
	}
	return out
}
