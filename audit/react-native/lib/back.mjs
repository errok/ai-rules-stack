/**
 * Reads the app's Go back (golang stack: gin) without compiling it: routes from router/router.go, each handler's
 * request / response types from its controller body, and the JSON shape of those types from their structs.
 * Relies on the back's conventions — gofmt'd code, `var req X` + `ShouldBindJSON(c, &req)`,
 * `c.JSON(status, ToXDto(...))` with `func ToXDto(...) XDto` in the same package.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const HTTP_METHODS = 'GET|POST|PUT|PATCH|DELETE';

/** The back sits next to the app as `<app>-back` (shooter → ../shooter-back), or at AUDIT_BACK_DIR. */
export const resolveBackDir = (frontRoot) => {
  const dir = process.env.AUDIT_BACK_DIR ?? join(frontRoot, '..', `${basename(frontRoot)}-back`);
  if (!existsSync(join(dir, 'router', 'router.go'))) {
    throw new Error(`Go back not found at ${dir} — set AUDIT_BACK_DIR to its path.`);
  }
  return dir;
};

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

const parseImports = (text) => {
  const imports = new Map();
  const block = text.match(/^import \(([\s\S]*?)^\)/m)?.[1] ?? text.match(/^import (.+)$/m)?.[1] ?? '';
  for (const m of block.matchAll(/^\s*(?:(\w+)\s+)?"([^"]+)"/gm)) {
    const path = m[2];
    imports.set(m[1] ?? path.split('/').pop(), path);
  }
  return imports;
};

// ─── Packages ────────────────────────────────────────────────────────────────

const packageCache = new Map();

/** Every non-test .go file of a directory, with its imports, funcs and structs. */
const loadPackage = (backDir, relDir) => {
  if (packageCache.has(relDir)) {
    return packageCache.get(relDir);
  }
  const absDir = join(backDir, relDir);
  const pkg = { relDir, files: [], funcs: new Map(), methods: new Map(), structs: new Map(), aliases: new Map() };
  packageCache.set(relDir, pkg);
  if (!existsSync(absDir)) {
    return pkg;
  }

  for (const name of readdirSync(absDir)) {
    if (!name.endsWith('.go') || name.endsWith('_test.go')) {
      continue;
    }
    const relFile = `${relDir}/${name}`;
    const text = readFileSync(join(absDir, name), 'utf8');
    const file = { relFile, text, imports: parseImports(text) };
    pkg.files.push(file);

    for (const m of text.matchAll(/^func (?:\((?:\w+ )?\*?(\w+)\) )?(\w+)\(([^)]*)\)\s*([^{]*)\{\n([\s\S]*?)^\}/gm)) {
      const entry = { name: m[2], file, line: lineOf(text, m.index), returns: m[4].trim(), body: m[5] };
      if (m[1]) {
        pkg.methods.set(`${m[1]}.${m[2]}`, entry);
      } else {
        pkg.funcs.set(m[2], entry);
      }
    }

    for (const m of text.matchAll(/^type (\w+) struct \{\n([\s\S]*?)^\}/gm)) {
      pkg.structs.set(m[1], { name: m[1], file, line: lineOf(text, m.index), body: m[2] });
    }
    for (const m of text.matchAll(/^type (\w+) = ([\w.]+)/gm)) {
      pkg.aliases.set(m[1], { target: m[2], file });
    }
  }
  return pkg;
};

// ─── Types → shapes ──────────────────────────────────────────────────────────
// A shape is the JSON contract both sides are reduced to:
//   { kind: 'string' | 'number' | 'boolean' | 'unknown' | 'void', nullable?, label? }
//   { kind: 'array', elem, nullable? }   { kind: 'map', elem, nullable? }
//   { kind: 'object', name, fields: Map<jsonName, field>, nullable?, loc }
// field: { shape, optional, required, loc }   loc: { repo: 'back', file, line }

const GO_BASIC = new Map([
  ['string', 'string'],
  ['bool', 'boolean'],
  ['byte', 'number'],
  ['rune', 'number'],
  ['time.Time', 'string'],
  ['uuid.UUID', 'string'],
  ['json.RawMessage', 'unknown'],
  ['any', 'unknown'],
  ['interface{}', 'unknown'],
]);

const isGoNumber = (name) => /^(u?int(8|16|32|64)?|float(32|64)|uintptr)$/.test(name);

const moduleRel = (ctx, importPath) =>
  importPath.startsWith(`${ctx.module}/`) ? importPath.slice(ctx.module.length + 1) : null;

/** Resolves a Go type expression written in `file` of `pkg` to a shape. */
const goTypeToShape = (ctx, pkg, file, expr, seen = new Set()) => {
  const t = expr.trim();
  if (t.startsWith('*')) {
    return { ...goTypeToShape(ctx, pkg, file, t.slice(1), seen), nullable: true };
  }
  if (t.startsWith('[]')) {
    return { kind: 'array', elem: goTypeToShape(ctx, pkg, file, t.slice(2), seen) };
  }
  const map = t.match(/^map\[[^\]]+\](.+)$/);
  if (map) {
    return { kind: 'map', elem: goTypeToShape(ctx, pkg, file, map[1], seen) };
  }
  if (GO_BASIC.has(t)) {
    return { kind: GO_BASIC.get(t) };
  }
  if (isGoNumber(t)) {
    return { kind: 'number' };
  }

  const qualified = t.match(/^(\w+)\.(\w+)$/);
  if (qualified) {
    const rel = moduleRel(ctx, file.imports.get(qualified[1]) ?? '');
    if (!rel) {
      return { kind: 'unknown', label: t };
    }
    return structShape(ctx, loadPackage(ctx.backDir, rel), qualified[2], seen);
  }
  return structShape(ctx, pkg, t, seen);
};

const structShape = (ctx, pkg, name, seen) => {
  const alias = pkg.aliases.get(name);
  if (alias) {
    return goTypeToShape(ctx, pkg, alias.file, alias.target, seen);
  }
  const struct = pkg.structs.get(name);
  if (!struct) {
    return { kind: 'unknown', label: name };
  }
  const key = `${pkg.relDir}.${name}`;
  if (seen.has(key)) {
    return { kind: 'unknown', label: `${name} (recursive)` };
  }
  const nextSeen = new Set(seen).add(key);

  const fields = new Map();
  const lines = struct.body.split('\n');
  lines.forEach((raw, i) => {
    const line = raw.replace(/\/\/.*$/, '').trim();
    if (!line) {
      return;
    }
    const tag = line.match(/`([^`]*)`/)?.[1] ?? '';
    const decl = line.replace(/`[^`]*`/, '').trim();
    const json = tag.match(/json:"([^"]*)"/)?.[1];
    const binding = tag.match(/binding:"([^"]*)"/)?.[1] ?? '';
    const parts = decl.split(/\s+/);

    // Embedded struct without a json name: its fields are promoted.
    if (parts.length === 1 && !json) {
      const embedded = goTypeToShape(ctx, pkg, struct.file, parts[0], nextSeen);
      if (embedded.kind === 'object') {
        for (const [k, v] of embedded.fields) {
          fields.set(k, v);
        }
      }
      return;
    }
    if (json === '-') {
      return;
    }
    const [jsonName, ...opts] = (json ?? '').split(',');
    const goName = parts.length === 1 ? parts[0].replace(/^\*/, '').split('.').pop() : parts[0];
    const typeExpr = parts.length === 1 ? parts[0] : parts.slice(1).join(' ');
    fields.set(jsonName || goName, {
      shape: goTypeToShape(ctx, pkg, struct.file, typeExpr, nextSeen),
      optional: opts.includes('omitempty'),
      required: binding.split(',').includes('required'),
      loc: { repo: 'back', file: struct.file.relFile, line: struct.line + i + 1 },
    });
  });

  return { kind: 'object', name, fields, loc: { repo: 'back', file: struct.file.relFile, line: struct.line } };
};

// ─── Handlers ────────────────────────────────────────────────────────────────

/** Request / response / query params of `Controller.<method>` in a controller package. */
const readHandler = (ctx, pkg, method) => {
  const fn = pkg.methods.get(`Controller.${method}`);
  if (!fn) {
    return { loc: null, request: null, response: { kind: 'unknown', label: 'handler not found' }, queries: [] };
  }
  const { body, file } = fn;

  let request = null;
  const bound = body.match(/ShouldBind\w*\((?:c,\s*)?&(\w+)\)/);
  if (bound) {
    const typeExpr =
      body.match(new RegExp(`var ${bound[1]} ([\\w.*\\[\\]]+)`))?.[1] ??
      body.match(new RegExp(`${bound[1]} :?= &?([\\w.]+)\\{`))?.[1];
    request = typeExpr
      ? { typeName: typeExpr, shape: goTypeToShape(ctx, pkg, file, typeExpr) }
      : { typeName: '?', shape: { kind: 'unknown', label: `type of ${bound[1]}` } };
  }

  // Success bodies only: error paths go through helpers.AbortWithError or a non-2xx status.
  const responses = [];
  for (const m of body.matchAll(/c\.JSON\(\s*http\.Status(\w+),\s*/g)) {
    if (!['OK', 'Created', 'Accepted'].includes(m[1])) {
      continue;
    }
    const rest = body.slice(m.index + m[0].length);
    if (rest.startsWith('gin.H{')) {
      const end = rest.search(/\n\s*\}\)/);
      const literal = rest.slice(0, end === -1 ? rest.indexOf('})') : end);
      const fields = new Map(
        [...literal.matchAll(/"(\w+)":/g)].map((k) => [
          k[1],
          { shape: { kind: 'unknown', label: 'gin.H value' }, optional: false, required: false, loc: null },
        ]),
      );
      responses.push({ typeName: 'gin.H', shape: { kind: 'object', name: 'gin.H', fields, loc: null } });
      continue;
    }
    const expr = rest
      .split('\n')[0]
      .replace(/\)\s*$/, '')
      .trim();
    const call = expr.match(/^(\w+)\(/);
    const mapper = call ? pkg.funcs.get(call[1]) : null;
    if (mapper?.returns) {
      responses.push({ typeName: mapper.returns, shape: goTypeToShape(ctx, pkg, mapper.file, mapper.returns) });
    } else {
      responses.push({ typeName: expr, shape: { kind: 'unknown', label: expr } });
    }
  }
  if (/c\.String\(http\.StatusOK/.test(body)) {
    responses.push({ typeName: 'string', shape: { kind: 'string' } });
  }
  const noContent = /c\.Status\(http\.StatusNoContent\)/.test(body);
  const response = responses[0] ?? (noContent ? { typeName: '204 No Content', shape: { kind: 'void' } } : null);

  const queries = [...new Set([...body.matchAll(/c\.(?:Query|DefaultQuery|GetQuery)\("(\w+)"/g)].map((m) => m[1]))];

  return { loc: { repo: 'back', file: file.relFile, line: fn.line }, request, response, queries };
};

// ─── Router ──────────────────────────────────────────────────────────────────

/** Every route of router/router.go with its handler and its JSON contract. */
export const readBack = (backDir) => {
  packageCache.clear();
  const module = readFileSync(join(backDir, 'go.mod'), 'utf8').match(/^module (\S+)/m)[1];
  const ctx = { backDir, module };

  const routerRel = 'router/router.go';
  const text = readFileSync(join(backDir, routerRel), 'utf8');
  const imports = parseImports(text);

  const controllers = new Map();
  for (const m of text.matchAll(/(\w+)\s*:=\s*(?:new\((\w+)\.Controller\)|(\w+)\.NewController\(\))/g)) {
    const rel = moduleRel(ctx, imports.get(m[2] ?? m[3]) ?? '');
    if (rel) {
      controllers.set(m[1], rel);
    }
  }

  const groups = new Map([['router', '']]);
  for (const m of text.matchAll(/(\w+)\s*:=\s*(\w+)\.Group\("([^"]*)"\)/g)) {
    groups.set(m[1], (groups.get(m[2]) ?? '') + m[3]);
  }

  const routes = [];
  for (const m of text.matchAll(new RegExp(`^\\s*(\\w+)\\.(${HTTP_METHODS})\\("([^"]*)",\\s*(.*)\\)\\s*$`, 'gm'))) {
    if (!groups.has(m[1])) {
      continue;
    }
    const path = groups.get(m[1]) + m[3];
    const handlerArg = m[4].split(',').pop().trim();
    const [ctlVar, method] = handlerArg.split('.');
    const pkgDir = controllers.get(ctlVar);
    const handler = pkgDir ? readHandler(ctx, loadPackage(backDir, pkgDir), method) : null;
    routes.push({
      method: m[2],
      path: path.replace(/:(\w+)/g, '{$1}'),
      key: routeKey(m[2], path),
      handlerName: `${pkgDir?.split('/').pop() ?? ctlVar}.${method}`,
      routeLoc: { repo: 'back', file: routerRel, line: lineOf(text, m.index + m[0].indexOf(m[1])) },
      handler,
    });
  }
  return routes;
};

/** `GET /api/v1/sessions/{}` — path params anonymised so both sides match whatever they are named. */
export const routeKey = (method, path) =>
  `${method} ${path
    .split('?')[0]
    .replace(/:\w+|\{[^}]*\}/g, '{}')
    .replace(/\/$/, '')}`;
