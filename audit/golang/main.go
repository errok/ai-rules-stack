// Command audit checks a Go backend of the stack against the scriptable part of the stack's .claude rules and
// writes documentation/reports/audit-stack.md — a report meant to be read and acted on by a human or an AI agent.
// It has its own go.mod (stdlib only), so the backend's `go build ./...` never compiles it.
//
//	make audit     # in the backend: cd sub-modules/ai-rules-stack/audit/golang && go run . -root <backend>
//
// Exits 1 when an error-level finding remains. A finding can be silenced where it is legitimate with a
// comment on its line or the line above: `// audit-ignore B-XXX-00: reason`.
package main

import (
	"flag"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

type severity int

const (
	sevError severity = iota
	sevWarn
	sevInfo
)

type finding struct {
	file string
	line int
	msg  string
}

// check is the logic of one verification; its French wording lives in texts.go under the same id.
type check struct {
	id   string
	rule string // path under .claude/rules/
	sev  severity
	run  func(p *project) []finding
}

type goFile struct {
	rel         string // repo-relative, slash-separated
	dir         string
	ast         *ast.File
	src         []byte
	lines       []string
	imports     map[string]string // import path → local name
	importLines map[string]int
}

type project struct {
	root   string
	module string
	fset   *token.FileSet
	files  []*goFile
	byRel  map[string]*goFile
	byDir  map[string][]*goFile
}

// appName is the backend folder name, shown in the titles.
var appName string

var skippedDirs = map[string]bool{".git": true, "vendor": true, "sub-modules": true, "tmp": true, "bin": true, "scripts": true, "node_modules": true}

func main() {
	cwd, err := os.Getwd()
	if err != nil {
		fail(err)
	}
	rootFlag := flag.String("root", cwd, "backend repository root")
	outFlag := flag.String("out", "documentation/reports/audit-stack.md", "report path, relative to the root")
	flag.Parse()
	root, err := filepath.Abs(*rootFlag)
	if err != nil {
		fail(err)
	}
	appName = filepath.Base(root)

	p, err := loadProject(root)
	if err != nil {
		fail(err)
	}

	out := filepath.Join(root, *outFlag)
	rel, _ := filepath.Rel(root, out)
	printHeader()
	results := runChecks(p, allChecks(), printResult)
	if err := writeReport(p, results, out); err != nil {
		fail(err)
	}
	if errors := printSummary(results, rel); errors > 0 {
		os.Exit(1)
	}
}

func errorf(format string, args ...any) error { return fmt.Errorf(format, args...) }

func fail(err error) {
	fmt.Fprintln(os.Stderr, "audit:", err)
	os.Exit(2)
}

func allChecks() []check {
	var checks []check
	checks = append(checks, archChecks()...)
	checks = append(checks, typeChecks()...)
	checks = append(checks, dbChecks()...)
	checks = append(checks, apiChecks()...)
	checks = append(checks, miscChecks()...)
	checks = append(checks, toolChecks()...)
	return checks
}

// ─── Loading ─────────────────────────────────────────────────────────────────

func loadProject(root string) (*project, error) {
	gomod, err := os.ReadFile(filepath.Join(root, "go.mod"))
	if err != nil {
		return nil, fmt.Errorf("run from the repo root (go.mod not found): %w", err)
	}
	module := regexp.MustCompile(`(?m)^module (\S+)`).FindSubmatch(gomod)
	if module == nil {
		return nil, fmt.Errorf("no module line in go.mod")
	}

	p := &project{root: root, module: string(module[1]), fset: token.NewFileSet(), byRel: map[string]*goFile{}, byDir: map[string][]*goFile{}}
	err = filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			if path != root && skippedDirs[d.Name()] {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		src, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		file, err := parser.ParseFile(p.fset, path, src, parser.ParseComments)
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(root, path)
		rel = filepath.ToSlash(rel)
		f := &goFile{rel: rel, dir: pathDir(rel), ast: file, src: src, lines: strings.Split(string(src), "\n"), imports: map[string]string{}, importLines: map[string]int{}}
		for _, spec := range file.Imports {
			importPath, _ := strconv.Unquote(spec.Path.Value)
			name := importPath[strings.LastIndex(importPath, "/")+1:]
			if spec.Name != nil {
				name = spec.Name.Name
			}
			f.imports[importPath] = name
			f.importLines[importPath] = p.fset.Position(spec.Pos()).Line
		}
		p.files = append(p.files, f)
		p.byRel[rel] = f
		p.byDir[f.dir] = append(p.byDir[f.dir], f)
		return nil
	})
	return p, err
}

func pathDir(rel string) string {
	if i := strings.LastIndex(rel, "/"); i >= 0 {
		return rel[:i]
	}
	return "."
}

// ─── Helpers shared by the checks ────────────────────────────────────────────

func (p *project) line(n ast.Node) int { return p.fset.Position(n.Pos()).Line }

func (p *project) under(prefixes ...string) []*goFile {
	var out []*goFile
	for _, f := range p.files {
		for _, prefix := range prefixes {
			if strings.HasPrefix(f.rel, prefix) {
				out = append(out, f)
				break
			}
		}
	}
	return out
}

// segment returns the n-th path segment of rel ("" when missing).
func segment(rel string, n int) string {
	parts := strings.Split(rel, "/")
	if n < len(parts) {
		return parts[n]
	}
	return ""
}

// localImport returns the repo-relative path of an import of this module, or "".
func (p *project) localImport(importPath string) string {
	if strings.HasPrefix(importPath, p.module+"/") {
		return strings.TrimPrefix(importPath, p.module+"/")
	}
	return ""
}

// selectorOf returns "pkg.Name" for a selector on an identifier, else "".
func selectorOf(expr ast.Expr) string {
	sel, ok := expr.(*ast.SelectorExpr)
	if !ok {
		return ""
	}
	id, ok := sel.X.(*ast.Ident)
	if !ok {
		return ""
	}
	return id.Name + "." + sel.Sel.Name
}

func hasSuffixAny(s string, suffixes ...string) bool {
	for _, suffix := range suffixes {
		if strings.HasSuffix(s, suffix) {
			return true
		}
	}
	return false
}

// tagKeys returns the keys of a struct tag literal (`gorm:"…" json:"…"` → gorm, json).
func tagKeys(tag *ast.BasicLit) []string {
	if tag == nil {
		return nil
	}
	var keys []string
	for _, m := range regexp.MustCompile(`(\w+):"`).FindAllStringSubmatch(tag.Value, -1) {
		keys = append(keys, m[1])
	}
	return keys
}

func tagValue(tag *ast.BasicLit, key string) string {
	if tag == nil {
		return ""
	}
	m := regexp.MustCompile(key + `:"([^"]*)"`).FindStringSubmatch(tag.Value)
	if m == nil {
		return ""
	}
	return m[1]
}

// eachStruct calls fn for every struct type declared in the file.
func eachStruct(f *goFile, fn func(name string, spec *ast.TypeSpec, st *ast.StructType)) {
	for _, decl := range f.ast.Decls {
		gen, ok := decl.(*ast.GenDecl)
		if !ok || gen.Tok != token.TYPE {
			continue
		}
		for _, s := range gen.Specs {
			spec := s.(*ast.TypeSpec)
			if st, ok := spec.Type.(*ast.StructType); ok {
				fn(spec.Name.Name, spec, st)
			}
		}
	}
}

// receiverType returns the receiver type name of a method ("" for a plain function).
func receiverType(fn *ast.FuncDecl) string {
	if fn.Recv == nil || len(fn.Recv.List) == 0 {
		return ""
	}
	t := fn.Recv.List[0].Type
	if star, ok := t.(*ast.StarExpr); ok {
		t = star.X
	}
	if id, ok := t.(*ast.Ident); ok {
		return id.Name
	}
	return ""
}

func receiverName(fn *ast.FuncDecl) string {
	if fn.Recv == nil || len(fn.Recv.List) == 0 || len(fn.Recv.List[0].Names) == 0 {
		return ""
	}
	return fn.Recv.List[0].Names[0].Name
}

// isGinHandler reports whether fn is a method taking a *gin.Context.
func isGinHandler(f *goFile, fn *ast.FuncDecl) bool {
	if fn.Recv == nil || fn.Type.Params == nil {
		return false
	}
	ginName := f.imports["github.com/gin-gonic/gin"]
	for _, field := range fn.Type.Params.List {
		if star, ok := field.Type.(*ast.StarExpr); ok && ginName != "" && selectorOf(star.X) == ginName+".Context" {
			return true
		}
	}
	return false
}

func funcs(f *goFile) []*ast.FuncDecl {
	var out []*ast.FuncDecl
	for _, decl := range f.ast.Decls {
		if fn, ok := decl.(*ast.FuncDecl); ok {
			out = append(out, fn)
		}
	}
	return out
}
