/**
 * Reads the app with the TypeScript compiler: a symbol-level call graph (each top-level declaration → the
 * top-level declarations it references, JSX included), every HTTP call made through `r` / `rPublic`
 * (`utils/fetch.ts`), and the JSON shape of the types those calls send and receive.
 */

import ts from 'typescript';

import { readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const EXCLUDED_DIRS = new Set(['node_modules', 'android', 'ios', 'sub-modules', 'scripts', 'tools', 'docs']);
const FETCH_FILE = 'utils/fetch.ts';
const HTTP_CLIENTS = new Set(['r', 'rPublic']);

export const loadFront = (root) => {
  const config = ts.readConfigFile(join(root, 'tsconfig.json'), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const host = {
    getScriptFileNames: () => parsed.fileNames,
    getScriptVersion: () => '0',
    getScriptSnapshot: (f) =>
      ts.sys.fileExists(f) ? ts.ScriptSnapshot.fromString(readFileSync(f, 'utf8')) : undefined,
    getCurrentDirectory: () => root,
    getCompilationSettings: () => parsed.options,
    getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
  };
  const service = ts.createLanguageService(host, ts.createDocumentRegistry());
  const program = service.getProgram();
  const checker = program.getTypeChecker();

  const rel = (fileName) => relative(root, fileName).split(sep).join('/');
  const isProjectFile = (fileName) => {
    const r = rel(fileName);
    return !r.startsWith('..') && !r.split('/').some((part) => EXCLUDED_DIRS.has(part));
  };
  const sourceFiles = program.getSourceFiles().filter((sf) => !sf.isDeclarationFile && isProjectFile(sf.fileName));
  const projectFiles = new Set(sourceFiles.map((sf) => sf.fileName));

  const locOf = (node) => {
    const sf = node.getSourceFile();
    return {
      repo: 'front',
      file: rel(sf.fileName),
      line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
    };
  };

  return { root, service, program, checker, sourceFiles, projectFiles, rel, locOf };
};

const unalias = (checker, symbol) =>
  symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;

// ─── Call graph ──────────────────────────────────────────────────────────────

/** Name under which a top-level declaration is a graph node; null for type-only / import statements. */
const nodeNameOf = (decl) => {
  if (ts.isVariableDeclaration(decl)) {
    return ts.isIdentifier(decl.name) ? decl.name.text : null;
  }
  if (ts.isFunctionDeclaration(decl) || ts.isClassDeclaration(decl) || ts.isEnumDeclaration(decl)) {
    return decl.name?.text ?? 'default';
  }
  if (ts.isExportAssignment(decl)) {
    return 'default';
  }
  if (
    ts.isInterfaceDeclaration(decl) ||
    ts.isTypeAliasDeclaration(decl) ||
    ts.isImportDeclaration(decl) ||
    ts.isImportEqualsDeclaration(decl) ||
    ts.isExportDeclaration(decl) ||
    ts.isModuleDeclaration(decl)
  ) {
    return null;
  }
  return '<module>';
};

/** The top-level declaration a node belongs to (the VariableDeclaration, not its whole statement). */
const ownerOf = (node) => {
  let n = node;
  while (n.parent && !ts.isSourceFile(n.parent)) {
    if (
      ts.isVariableDeclaration(n) &&
      ts.isVariableStatement(n.parent.parent) &&
      ts.isSourceFile(n.parent.parent.parent)
    ) {
      return n;
    }
    n = n.parent;
  }
  if (ts.isVariableStatement(n) && n.declarationList.declarations.length === 1) {
    return n.declarationList.declarations[0];
  }
  return n;
};

const isInTypePosition = (node) => {
  for (let n = node.parent; n; n = n.parent) {
    if (ts.isTypeNode(n) && !ts.isExpressionWithTypeArguments(n)) {
      return true;
    }
    if (ts.isStatement(n) || ts.isSourceFile(n)) {
      return false;
    }
  }
  return false;
};

/**
 * nodes: id → { id, name, loc, edges: Set<id>, httpCalls: CallExpression[] }
 * An edge means "this declaration's code references that one" — a call, a JSX render, a hook, a store read.
 */
export const buildCallGraph = (front) => {
  const { checker, sourceFiles, projectFiles, rel, locOf } = front;
  const nodes = new Map();

  const idOf = (decl) => {
    const name = nodeNameOf(decl);
    return name ? `${rel(decl.getSourceFile().fileName)}#${name}` : null;
  };

  const isHttpClient = (callee) => {
    if (!ts.isIdentifier(callee) || !HTTP_CLIENTS.has(callee.text)) {
      return false;
    }
    const decl = unalias(checker, checker.getSymbolAtLocation(callee))?.declarations?.[0];
    return decl != null && rel(decl.getSourceFile().fileName) === FETCH_FILE;
  };

  const visit = (n, node) => {
    if (ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n)) {
      return;
    }
    if (ts.isCallExpression(n) && isHttpClient(n.expression) && !node.id.startsWith(`${FETCH_FILE}#`)) {
      node.httpCalls.push(n);
    }
    if (ts.isIdentifier(n) && !isInTypePosition(n)) {
      let symbol = checker.getSymbolAtLocation(n);
      if (ts.isShorthandPropertyAssignment(n.parent) && n.parent.name === n) {
        symbol = checker.getShorthandAssignmentValueSymbol(n.parent) ?? symbol;
      }
      for (const decl of unalias(checker, symbol)?.declarations ?? []) {
        if (!projectFiles.has(decl.getSourceFile().fileName)) {
          continue;
        }
        const target = idOf(ownerOf(decl));
        if (target && target !== node.id) {
          node.edges.add(target);
        }
      }
    }
    ts.forEachChild(n, (child) => visit(child, node));
  };

  for (const sf of sourceFiles) {
    for (const statement of sf.statements) {
      const decls = ts.isVariableStatement(statement) ? statement.declarationList.declarations : [statement];
      for (const decl of decls) {
        const id = idOf(decl);
        if (!id) {
          continue;
        }
        if (!nodes.has(id)) {
          const name = id.split('#')[1];
          nodes.set(id, { id, name, loc: locOf(decl), edges: new Set(), httpCalls: [] });
        }
        visit(decl, nodes.get(id));
      }
    }
  }

  for (const node of nodes.values()) {
    for (const target of node.edges) {
      if (!nodes.has(target)) {
        node.edges.delete(target);
      }
    }
  }
  return nodes;
};

// ─── HTTP calls ──────────────────────────────────────────────────────────────

const evalString = (checker, expr, depth = 0) => {
  if (!expr || depth > 8) {
    return null;
  }
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    return expr.text;
  }
  if (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr)) {
    return evalString(checker, expr.expression, depth + 1);
  }
  if (ts.isIdentifier(expr)) {
    const decl = unalias(checker, checker.getSymbolAtLocation(expr))?.valueDeclaration;
    const isConst = decl && ts.isVariableDeclaration(decl) && decl.parent.flags & ts.NodeFlags.Const;
    return isConst ? evalString(checker, decl.initializer, depth + 1) : null;
  }
  if (ts.isTemplateExpression(expr)) {
    let out = expr.head.text;
    for (const span of expr.templateSpans) {
      out += evalString(checker, span.expression, depth + 1) ?? `{${span.expression.getText()}}`;
      out += span.literal.text;
    }
    return out;
  }
  if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = evalString(checker, expr.left, depth + 1);
    const right = evalString(checker, expr.right, depth + 1);
    return left != null && right != null ? left + right : null;
  }
  return null;
};

const propertyOf = (objectLiteral, name) =>
  objectLiteral?.properties.find((p) => p.name && ts.isIdentifier(p.name) && p.name.text === name);

const propertyValue = (prop) =>
  !prop
    ? null
    : ts.isShorthandPropertyAssignment(prop)
      ? prop.name
      : ts.isPropertyAssignment(prop)
        ? prop.initializer
        : null;

/** What one `r(...)` / `rPublic(...)` call sends and expects. */
export const readHttpCall = (front, call) => {
  const { checker } = front;
  const params = call.arguments[0] && ts.isObjectLiteralExpression(call.arguments[0]) ? call.arguments[0] : null;
  const url = evalString(checker, propertyValue(propertyOf(params, 'url')));
  const method = evalString(checker, propertyValue(propertyOf(params, 'method'))) ?? 'GET';

  const typeArg = call.typeArguments?.[0];
  const responseType = typeArg ? checker.getTypeFromTypeNode(typeArg) : null;

  const dataExpr = propertyValue(propertyOf(params, 'data'));
  const dataType = dataExpr ? checker.getNonNullableType(checker.getTypeAtLocation(dataExpr)) : null;

  return {
    client: call.expression.getText(),
    method,
    url,
    loc: front.locOf(call),
    response: responseType
      ? { typeName: typeArg.getText(), shape: toShape(front, responseType) }
      : { typeName: '?', shape: { kind: 'unknown', label: 'untyped call' } },
    data: dataType ? { typeName: checker.typeToString(dataType), shape: toShape(front, dataType) } : null,
  };
};

// ─── Types → shapes (same model as lib/back.mjs) ─────────────────────────────

const primitiveKind = (type) => {
  const f = type.flags;
  if (f & ts.TypeFlags.StringLike) {
    return 'string';
  }
  if (f & (ts.TypeFlags.NumberLike | ts.TypeFlags.BigIntLike)) {
    return 'number';
  }
  if (f & ts.TypeFlags.BooleanLike) {
    return 'boolean';
  }
  return null;
};

export const toShape = (front, type, seen = new Set()) => {
  const { checker } = front;
  const label = checker.typeToString(type);
  const f = type.flags;

  if (f & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) {
    return { kind: 'unknown', label };
  }
  if (f & (ts.TypeFlags.Void | ts.TypeFlags.Undefined | ts.TypeFlags.Never)) {
    return { kind: 'void' };
  }

  if (type.isUnion()) {
    const nullable = type.types.some((t) => t.flags & ts.TypeFlags.Null);
    const rest = type.types.filter(
      (t) => !(t.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void)),
    );
    const kinds = new Set(rest.map(primitiveKind));
    if (rest.length > 0 && kinds.size === 1 && !kinds.has(null)) {
      return { kind: [...kinds][0], nullable, label: rest.length > 1 ? label : undefined };
    }
    if (rest.length === 1) {
      return { ...toShape(front, rest[0], seen), nullable };
    }
    return { kind: 'unknown', label, nullable };
  }

  const primitive = primitiveKind(type);
  if (primitive) {
    return { kind: primitive };
  }
  if (checker.isArrayType(type)) {
    return { kind: 'array', elem: toShape(front, checker.getTypeArguments(type)[0], seen) };
  }

  if (f & ts.TypeFlags.Object || type.isIntersection()) {
    if (seen.has(type.id)) {
      return { kind: 'unknown', label: `${label} (recursive)` };
    }
    const nextSeen = new Set(seen).add(type.id);
    const props = checker.getPropertiesOfType(type);
    const stringIndex = checker.getIndexInfosOfType(type).find((i) => i.keyType.flags & ts.TypeFlags.String);
    if (props.length === 0 && stringIndex) {
      return { kind: 'map', elem: toShape(front, stringIndex.type, nextSeen) };
    }

    const fields = new Map();
    for (const prop of props) {
      const decl = prop.valueDeclaration ?? prop.declarations?.[0];
      const propType = decl ? checker.getTypeOfSymbolAtLocation(prop, decl) : checker.getTypeOfSymbol(prop);
      const optional = (prop.flags & ts.SymbolFlags.Optional) !== 0;
      fields.set(prop.name, {
        shape: toShape(front, propType, nextSeen),
        optional,
        required: !optional,
        symbol: prop,
        loc: decl ? front.locOf(decl) : null,
      });
    }
    const named = type.aliasSymbol ?? (type.symbol?.name?.startsWith('__') ? null : type.symbol);
    const namedDecl = named?.declarations?.[0];
    return { kind: 'object', name: named?.name ?? label, fields, loc: namedDecl ? front.locOf(namedDecl) : null, type };
  }

  return { kind: 'unknown', label };
};

// ─── Type flows ──────────────────────────────────────────────────────────────

/**
 * type → Set<type>: a value of the first type lands in a slot typed with the second (argument, JSX prop,
 * return, annotated variable, spread). With structural typing a DTO is often read through such a type —
 * `SessionSightAdviceDto` passed as a `SightAdviceDto` prop — which findReferences alone does not follow.
 */
export const buildTypeFlows = (front) => {
  const { checker, sourceFiles, projectFiles } = front;
  const flows = new Map();

  const isProjectObject = (type) => {
    if (!(type.flags & ts.TypeFlags.Object) && !type.isIntersection()) {
      return false;
    }
    const decl = (type.aliasSymbol ?? type.symbol)?.declarations?.[0];
    return decl != null && projectFiles.has(decl.getSourceFile().fileName);
  };

  const record = (from, to, depth = 0) => {
    const source = checker.getNonNullableType(from);
    const target = checker.getNonNullableType(to);
    if (depth > 3 || source === target) {
      return;
    }
    if (checker.isArrayType(source) && checker.isArrayType(target)) {
      record(checker.getTypeArguments(source)[0], checker.getTypeArguments(target)[0], depth + 1);
      return;
    }
    if (!isProjectObject(source)) {
      return;
    }
    for (const t of target.isUnion() ? target.types : [target]) {
      if (t !== source && isProjectObject(t)) {
        if (!flows.has(source)) {
          flows.set(source, new Set());
        }
        flows.get(source).add(t);
      }
    }
  };

  const visit = (node) => {
    const isValue =
      ts.isPropertyAccessExpression(node) ||
      ts.isCallExpression(node) ||
      ts.isAwaitExpression(node) ||
      (ts.isIdentifier(node) &&
        !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) &&
        (ts.isShorthandPropertyAssignment(node.parent) ||
          !(ts.isDeclaration(node.parent) && node.parent.name === node)));
    if (isValue) {
      try {
        const contextual = checker.getContextualType(node);
        if (contextual) {
          record(checker.getTypeAtLocation(node), contextual);
        }
      } catch {
        // Not an expression position the checker can type — nothing flows.
      }
    }
    ts.forEachChild(node, visit);
  };
  for (const sf of sourceFiles) {
    visit(sf);
  }
  return flows;
};

/** Every type a value of `type` may be read through, `type` included. */
export const flowClosure = (flows, type) => {
  const seen = new Set([type]);
  const queue = [type];
  while (queue.length) {
    for (const next of flows.get(queue.shift()) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
};

/** Non-declaration references to a type property across the app (reads and writes). */
export const referencesOf = (front, symbol) => {
  const decl = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
  if (!decl?.name) {
    return null;
  }
  const sf = decl.getSourceFile();
  const groups = front.service.findReferences(sf.fileName, decl.name.getStart(sf)) ?? [];
  const refs = [];
  for (const group of groups) {
    for (const ref of group.references) {
      if (ref.isDefinition) {
        continue;
      }
      const program = front.program.getSourceFile(ref.fileName);
      const line = program ? program.getLineAndCharacterOfPosition(ref.textSpan.start).line + 1 : 0;
      refs.push({ file: front.rel(ref.fileName), line, isWrite: ref.isWriteAccess === true });
    }
  }
  return refs;
};
