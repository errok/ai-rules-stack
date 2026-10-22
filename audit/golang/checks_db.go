package main

import (
	"fmt"
	"go/ast"
	"go/token"
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

// tableSQLFiles lists the DDL of the project: database/tables/**/*.sql (one folder per schema) and init.sql.
func tableSQLFiles(root string) []string {
	var files []string
	_ = filepath.WalkDir(filepath.Join(root, "database", "tables"), func(path string, d os.DirEntry, err error) error {
		if err == nil && !d.IsDir() && strings.HasSuffix(path, ".sql") {
			files = append(files, path)
		}
		return nil
	})
	return append(files, filepath.Join(root, "database", "init.sql"))
}

// readForeignKeys lists `FOREIGN KEY (col) REFERENCES schema.table` from the DDL files.
func readForeignKeys(root string) []sqlForeignKey {
	files := tableSQLFiles(root)
	createRe := regexp.MustCompile(`(?i)CREATE TABLE (?:IF NOT EXISTS )?(?:"?(\w+)"?\.)?"?(\w+)"?`)
	fkRe := regexp.MustCompile(`(?i)FOREIGN KEY \((\w+)\) REFERENCES (?:"?(\w+)"?\.)?"?(\w+)"?`)
	inlineRe := regexp.MustCompile(`(?i)^\s*(\w+)\s+[^,]*?\bREFERENCES (?:"?(\w+)"?\.)?"?(\w+)"?`)
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
				seen := map[sqlForeignKey]bool{} // a table file may declare the same key again in its idempotent upgrade block
				for _, fk := range fks {
					if seen[fk] {
						continue
					}
					seen[fk] = true
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
		{
			id: "B-DB-08", rule: ruleDatabase, sev: sevError,
			run: func(p *project) []finding {
				known := knownTables(p)
				var files []*goFile
				for _, f := range p.files {
					if !strings.HasPrefix(f.rel, "database/") {
						files = append(files, f)
					}
				}
				var out []finding
				for _, f := range files {
					ast.Inspect(f.ast, func(n ast.Node) bool {
						call, ok := n.(*ast.CallExpr)
						if !ok {
							return true
						}
						sel, ok := call.Fun.(*ast.SelectorExpr)
						if !ok || !queryMethods[sel.Sel.Name] {
							return true
						}
						for _, arg := range call.Args {
							ast.Inspect(arg, func(m ast.Node) bool {
								lit, ok := m.(*ast.BasicLit)
								if !ok || lit.Kind != token.STRING {
									return true
								}
								value, err := strconv.Unquote(lit.Value)
								if err != nil {
									return true
								}
								if table := hardCodedTable(sel.Sel.Name, value, known); table != "" {
									out = append(out, finding{f.rel, p.line(lit), fmt.Sprintf("`%s(…)` écrit la table `%s` en dur", sel.Sel.Name, table)})
								}
								return true
							})
						}
						return true
					})
				}
				return out
			},
		},
		{
			id: "B-DB-09", rule: ruleDatabase, sev: sevError,
			run: func(p *project) []finding {
				var out []finding
				for _, m := range readModels(p) {
					schema := ""
					if i := strings.Index(m.table, "."); i >= 0 {
						schema = m.table[:i]
					}
					switch {
					case schema == "" || schema == "public":
						out = append(out, finding{m.file.rel, p.line(m.st), fmt.Sprintf("`%s` : la table `%s` est dans `public`", m.name, m.table)})
					case m.file.dir != "database/model/"+schema:
						out = append(out, finding{m.file.rel, p.line(m.st), fmt.Sprintf("`%s` : la table `%s` est dans le schéma `%s`, le modèle doit être dans `database/model/%s/`", m.name, m.table, schema, schema)})
					}
				}
				return out
			},
		},
		{
			id: "B-DB-10", rule: ruleDatabase, sev: sevError,
			run: func(p *project) []finding {
				createRe := regexp.MustCompile(`(?i)^\s*CREATE TABLE (?:IF NOT EXISTS )?(?:"?(\w+)"?\.)?"?(\w+)"?`)
				var out []finding
				for _, path := range tableSQLFiles(p.root) {
					src, err := os.ReadFile(path)
					if err != nil {
						continue
					}
					rel, _ := filepath.Rel(p.root, path)
					rel = filepath.ToSlash(rel)
					folder := ""
					if strings.HasPrefix(rel, "database/tables/") {
						if parts := strings.Split(strings.TrimPrefix(rel, "database/tables/"), "/"); len(parts) > 1 {
							folder = parts[0]
						}
					}
					for i, line := range strings.Split(string(src), "\n") {
						m := createRe.FindStringSubmatch(line)
						if m == nil {
							continue
						}
						schema, table := m[1], m[2]
						switch {
						case schema == "" || strings.EqualFold(schema, "public"):
							out = append(out, finding{rel, i + 1, fmt.Sprintf("`CREATE TABLE %s` crée la table dans `public`", table)})
						case strings.HasPrefix(rel, "database/tables/") && folder != schema:
							out = append(out, finding{rel, i + 1, fmt.Sprintf("la table `%s.%s` doit être dans `database/tables/%s/`", schema, table, schema)})
						}
					}
				}
				return out
			},
		},
	}
}

// queryMethods are the GORM builder methods whose string arguments are SQL.
var queryMethods = map[string]bool{
	"Raw": true, "Exec": true, "Table": true, "Joins": true, "InnerJoins": true, "Where": true, "Not": true, "Or": true,
	"Select": true, "Order": true, "Group": true, "Having": true, "Pluck": true, "Distinct": true,
}

var (
	sqlTableRe    = regexp.MustCompile(`(?i)\b(?:from|join|into|update|table)\s+"?([a-z_]\w*(?:"?\.\"?[a-z_]\w*)?)`)
	createTableRe = regexp.MustCompile(`(?i)CREATE TABLE (?:IF NOT EXISTS )?(?:"?\w+"?\.)?"?(\w+)"?`)
)

// knownTables lists the short names of the project's tables, from the models and the DDL.
func knownTables(p *project) map[string]bool {
	known := map[string]bool{}
	for short := range readModels(p) {
		known[short] = true
	}
	for _, path := range tableSQLFiles(p.root) {
		src, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		for _, m := range createTableRe.FindAllStringSubmatch(string(src), -1) {
			known[m[1]] = true
		}
	}
	return known
}

// hardCodedTable returns the table a query string writes by name ("" when none): a schema-qualified or known table
// after FROM / JOIN / INTO / UPDATE / TABLE, a table in `Table("…")`, or a `table.column` qualifier. A table name
// belongs to the model's TableName() only; a query refers to it through the model or `database.TableOf`.
func hardCodedTable(method, value string, known map[string]bool) string {
	if method == "Table" {
		if strings.ContainsAny(value, " ?") {
			return ""
		}
		return value
	}
	for _, m := range sqlTableRe.FindAllStringSubmatch(value, -1) {
		name := strings.ReplaceAll(m[1], `"`, "")
		short := name[strings.LastIndex(name, ".")+1:]
		if strings.EqualFold(short, "set") && strings.EqualFold(strings.Fields(m[0])[0], "update") {
			continue
		}
		if strings.Contains(name, ".") || known[short] {
			return name
		}
	}
	for table := range known {
		if regexp.MustCompile(`(?i)(?:^|[^\w.])(?:\w+\.)?` + regexp.QuoteMeta(table) + `\.[a-z_]\w*`).MatchString(value) {
			return table
		}
	}
	return ""
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
