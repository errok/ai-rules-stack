/** Checks on the code layers: services, stores, TypeScript, naming, component structure, dead code. */

import ts from 'typescript';

import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { isComponentFile, isStackOwned } from '../lib/engine.mjs';

const RULE = {
  architecture: 'stack/core-rules/project-architecture-always.md',
  naming: 'stack/core-rules/naming-auto.md',
  cleanup: 'stack/core-rules/no-unrequested-cleanup-always.md',
  services: 'stack/service-rules/services-http-auto.md',
  auth: 'stack/auth-rules/supabase-auth-auto.md',
  stores: 'stack/store-rules/zustand-stores-auto.md',
  typescript: 'stack/ts-rules/typescript-conventions-auto.md',
  async: 'stack/ts-rules/async-await-no-promise-chains-auto.md',
  structure: 'stack/component-rules/component-screen-structure-auto.md',
  effects: 'stack/component-rules/useeffect-no-inline-functions-auto.md',
  callbacks: 'stack/component-rules/handle-callback-prefix-auto.md',
  loading: 'stack/ui-rules/loading-flags-naming.md',
};

const SECTIONS = [
  'Params',
  'Store',
  'Hooks',
  'States & Refs',
  'Init',
  'Helpers',
  'Callbacks',
  'Effects',
  'Renderers',
  'Loading',
  'Error',
  'No data',
  'Main renderer',
];
const OPTIONAL_SECTIONS = new Set(['No data']);
const BANNER = /^\s*\/\/ -------- (.+?) --------/;

const isFunctionLike = (node) => node && (ts.isArrowFunction(node) || ts.isFunctionExpression(node));

const moduleOf = (node) =>
  ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : null;

/** Exported value names of a file (`export function X`, `export const X`, `export default function X`, `export { X }`). */
const exportedNames = (sf) => {
  const names = [];
  for (const st of sf.statements) {
    const exported = ts.getCombinedModifierFlags(st) & ts.ModifierFlags.Export;
    if (exported && (ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && st.name) {
      names.push(st.name.text);
    } else if (exported && ts.isVariableStatement(st)) {
      names.push(...st.declarationList.declarations.filter((d) => ts.isIdentifier(d.name)).map((d) => d.name.text));
    } else if (
      ts.isExportDeclaration(st) &&
      !st.moduleSpecifier &&
      st.exportClause &&
      ts.isNamedExports(st.exportClause)
    ) {
      names.push(...st.exportClause.elements.map((e) => e.name.text));
    }
  }
  return names;
};

export const codeChecks = [
  // ─── Services / stores / auth ──────────────────────────────────────────────
  {
    id: 'F-SVC-01',
    rule: RULE.services,
    sev: 'error',
    run: (p) => {
      const out = [];
      for (const f of p.under((rel) => rel.startsWith('services/') && !rel.startsWith('services/auth/'))) {
        p.walk(f, (n) => ts.isTryStatement(n) && out.push(p.finding(f, n, 'bloc `try`')));
      }
      return out;
    },
  },
  {
    id: 'F-SVC-02',
    rule: RULE.architecture,
    sev: 'error',
    run: (p) => {
      const out = [];
      for (const f of p.files) {
        if (f.rel === 'utils/fetch.ts') {
          continue;
        }
        p.walk(f, (n) => {
          if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'fetch') {
            const decl = p.declOf(n.expression);
            if (!decl || !p.front.projectFiles.has(decl.getSourceFile().fileName)) {
              out.push(p.finding(f, n, '`fetch()` direct'));
            }
          }
        });
      }
      return out;
    },
  },
  {
    id: 'F-SVC-03',
    rule: RULE.auth,
    sev: 'error',
    run: (p) => {
      const out = [];
      for (const f of p.files) {
        if (f.rel.startsWith('services/auth/')) {
          continue;
        }
        for (const st of f.sf.statements) {
          const mod = moduleOf(st);
          if (mod && /services\/auth\/providers\//.test(mod)) {
            out.push(p.finding(f, st, `importe \`${mod}\``));
          }
        }
      }
      return out;
    },
  },
  {
    id: 'F-STORE-01',
    rule: RULE.stores,
    sev: 'error',
    run: (p) => {
      const out = [];
      for (const f of p.under('stores/')) {
        for (const st of f.sf.statements) {
          const mod = moduleOf(st);
          const clause = st.importClause;
          const typeOnly =
            clause?.isTypeOnly ||
            (clause &&
              !clause.name &&
              clause.namedBindings &&
              ts.isNamedImports(clause.namedBindings) &&
              clause.namedBindings.elements.every((e) => e.isTypeOnly));
          if (mod && !typeOnly && (mod.startsWith('services/') || mod === 'utils/fetch')) {
            out.push(p.finding(f, st, `importe \`${mod}\``));
          }
        }
      }
      return out;
    },
  },
  {
    id: 'F-STORE-02',
    rule: RULE.stores,
    sev: 'warn',
    run: (p) => {
      let clear = '';
      try {
        clear = readFileSync(join(p.root, 'stores/utils/clearStores.ts'), 'utf8');
      } catch {
        return [{ file: 'stores/utils/clearStores.ts', line: 0, msg: 'fichier absent' }];
      }
      const out = [];
      for (const f of p.under((rel) => /^stores\/[^/]+\.ts$/.test(rel))) {
        for (const st of f.sf.statements) {
          if (!ts.isVariableStatement(st)) {
            continue;
          }
          for (const d of st.declarationList.declarations) {
            if (
              ts.isIdentifier(d.name) &&
              d.initializer?.getText(f.sf).startsWith('create') &&
              !clear.includes(d.name.text)
            ) {
              out.push(p.finding(f, d, `\`${d.name.text}\` n'est pas vidé dans \`clearAllStores()\``));
            }
          }
        }
      }
      return out;
    },
  },
  {
    id: 'F-STORE-03',
    rule: RULE.naming,
    sev: 'warn',
    run: (p) => {
      const out = [];
      for (const f of p.under('stores/')) {
        for (const st of f.sf.statements) {
          if (!ts.isVariableStatement(st)) {
            continue;
          }
          for (const d of st.declarationList.declarations) {
            const init = d.initializer?.getText(f.sf) ?? '';
            if (ts.isIdentifier(d.name) && /^create\b/.test(init) && !/^use[A-Z]\w*Store$/.test(d.name.text)) {
              out.push(p.finding(f, d, `\`${d.name.text}\` ne suit pas le format use{Nom}Store`));
            }
          }
        }
      }
      return out;
    },
  },

  // ─── TypeScript / naming ───────────────────────────────────────────────────
  {
    id: 'F-TS-01',
    rule: RULE.typescript,
    sev: 'error',
    run: (p) => {
      const out = [];
      for (const f of p.files) {
        p.walk(f, (n) => ts.isInterfaceDeclaration(n) && out.push(p.finding(f, n, `\`interface ${n.name.text}\``)));
      }
      return out;
    },
  },
  {
    id: 'F-TS-02',
    rule: RULE.typescript,
    sev: 'error',
    run: (p) => {
      const out = [];
      for (const f of p.files) {
        p.walk(f, (n) => {
          if (ts.isTypeReferenceNode(n) && /^(React\.)?(FC|FunctionComponent)$/.test(n.typeName.getText(f.sf))) {
            out.push(p.finding(f, n, `\`${n.getText(f.sf)}\` utilisé pour typer un composant`));
          }
        });
      }
      return out;
    },
  },
  {
    id: 'F-NAME-01',
    rule: RULE.naming,
    sev: 'error',
    run: (p) => {
      const out = [];
      const eligible = p.under(
        (rel) =>
          (/\.tsx$/.test(rel) && /^(screens|components|navigation)\//.test(rel) && !rel.startsWith('components/ds/')) ||
          /(^|\/)hooks\/use\w+\.tsx?$/.test(rel),
      );
      for (const f of eligible) {
        const base = basename(f.rel).replace(/\.tsx?$/, '');
        if (base === 'index' || base.endsWith('.types') || !/^([A-Z]|use[A-Z])/.test(base)) {
          continue;
        }
        const names = exportedNames(f.sf).filter((n) => /^([A-Z]|use[A-Z])/.test(n));
        if (names.length && !names.includes(base)) {
          out.push({
            file: f.rel,
            line: 1,
            msg: `le fichier \`${base}\` exporte ${names.map((n) => `\`${n}\``).join(', ')}`,
          });
        }
      }
      return out;
    },
  },
  {
    id: 'F-NAME-02',
    rule: RULE.naming,
    sev: 'warn',
    run: (p) => {
      const registered = new Set();
      for (const node of p.nodes.values()) {
        if (node.loc.file.startsWith('navigation/') || node.loc.file === 'App.tsx') {
          for (const target of node.edges) {
            registered.add(target);
          }
        }
      }
      const out = [];
      for (const f of p.appUnder('screens/', 'components/')) {
        for (const name of exportedNames(f.sf)) {
          if (!name.endsWith('Screen')) {
            continue;
          }
          if (f.rel.startsWith('components/')) {
            out.push({ file: f.rel, line: 1, msg: `\`${name}\` est sous components/` });
          } else if (!registered.has(`${f.rel}#${name}`)) {
            out.push({ file: f.rel, line: 1, msg: `\`${name}\` n'est déclaré dans aucune stack de navigation` });
          }
        }
      }
      return out;
    },
  },
  {
    id: 'F-NAME-03',
    rule: RULE.naming,
    sev: 'warn',
    run: (p) => {
      const out = [];
      for (const f of p.appUnder((rel) => /\.tsx?$/.test(rel))) {
        p.walk(f, (n) => {
          if (ts.isTypeAliasDeclaration(n) || ts.isInterfaceDeclaration(n)) {
            // `E…` types are the value types of `as const` enums (`type EX = (typeof EX)[keyof typeof EX]`).
            const name = n.name.text;
            if (!/^[TE][A-Z]/.test(name) && !/(Props|Dto|Params|Request)$/.test(name)) {
              out.push(p.finding(f, n, `le type \`${name}\` ne commence pas par T`));
            }
          } else if (ts.isEnumDeclaration(n) && !/^E[A-Z]/.test(n.name.text)) {
            out.push(p.finding(f, n, `l'enum \`${n.name.text}\` ne commence pas par E`));
          }
        });
      }
      return out;
    },
  },
  {
    id: 'F-NAME-04',
    rule: RULE.loading,
    sev: 'warn',
    run: (p) => {
      const out = [];
      for (const f of p.appUnder('screens/', 'components/', 'hooks/', 'stores/')) {
        p.walk(f, (n) => {
          if (!ts.isVariableDeclaration(n) || !ts.isArrayBindingPattern(n.name) || !n.initializer) {
            return;
          }
          if (!/^(React\.)?useState\b/.test(n.initializer.getText(f.sf))) {
            return;
          }
          const first = n.name.elements[0];
          const name = first && ts.isBindingElement(first) && ts.isIdentifier(first.name) ? first.name.text : '';
          if ((/loading|fetching/i.test(name) && !/^is[A-Z]\w*Loading$/.test(name)) || /LoadingLoading/.test(name)) {
            out.push(p.finding(f, n, `\`${name}\` ne dit pas ce qui charge (attendu : is…Loading)`));
          }
        });
      }
      return out;
    },
  },

  // ─── Structure ─────────────────────────────────────────────────────────────
  {
    id: 'F-BARREL-01',
    rule: RULE.structure,
    sev: 'error',
    run: (p) => {
      const allowed = new Set(['components/ds/index.ts', 'components/ds/composed/index.ts', 'services/auth/index.ts']);
      const out = [];
      for (const f of p.under((rel) => /(^|\/)index\.tsx?$/.test(rel) && rel.includes('/'))) {
        if (allowed.has(f.rel)) {
          continue;
        }
        const onlyExports = f.sf.statements.every((st) => ts.isExportDeclaration(st) || ts.isImportDeclaration(st));
        if (onlyExports && f.sf.statements.some(ts.isExportDeclaration)) {
          out.push({ file: f.rel, line: 1, msg: 'fichier qui ne fait que réexporter' });
        }
      }
      return out;
    },
  },
  {
    id: 'F-SECT-01',
    rule: RULE.structure,
    sev: 'warn',
    run: (p) => {
      const out = [];
      for (const f of p.under(isComponentFile)) {
        if (!exportedNames(f.sf).some((n) => /^[A-Z]/.test(n))) {
          continue;
        }
        const found = f.lines.map((l) => l.match(BANNER)?.[1]).filter(Boolean);
        const missing = SECTIONS.filter((s) => !OPTIONAL_SECTIONS.has(s) && !found.includes(s));
        const known = found.filter((s) => SECTIONS.includes(s));
        const firstPass = [...new Set(known)];
        const ordered = firstPass.every((s, i) => i === 0 || SECTIONS.indexOf(s) > SECTIONS.indexOf(firstPass[i - 1]));
        const unknown = found.filter((s) => !SECTIONS.includes(s));
        const parts = [];
        if (missing.length) {
          parts.push(`sections manquantes : ${missing.map((s) => `\`${s}\``).join(', ')}`);
        }
        if (!ordered) {
          parts.push('sections dans le désordre');
        }
        if (unknown.length) {
          parts.push(`section inconnue ${unknown.map((s) => `\`${s}\``).join(', ')}`);
        }
        if (parts.length) {
          out.push({ file: f.rel, line: 1, msg: parts.join(' · ') });
        }
      }
      return out;
    },
  },
  {
    id: 'F-SECT-02',
    rule: RULE.structure,
    sev: 'warn',
    run: (p) => {
      const out = [];
      for (const f of p.under(isComponentFile)) {
        f.lines.forEach((line, i) => {
          if (!BANNER.test(line)) {
            return;
          }
          const above = f.lines[i - 1] ?? '';
          const below = f.lines[i + 1] ?? '';
          const glued = (above.trim() !== '' && !/[{(]\s*$/.test(above)) || below.trim() !== '';
          if (glued) {
            out.push({ file: f.rel, line: i + 1, msg: `\`${line.trim()}\` est collé à la ligne voisine` });
          }
        });
      }
      return out;
    },
  },
  {
    id: 'F-ASYNC-01',
    rule: RULE.async,
    sev: 'warn',
    run: (p) => {
      const out = [];
      for (const f of p.appUnder('hooks/', 'services/', 'screens/', 'components/', 'utils/', 'stores/')) {
        p.walk(f, (n) => {
          if (!ts.isPropertyAccessExpression(n) || !['then', 'catch', 'finally'].includes(n.name.text)) {
            return;
          }
          if (!ts.isCallExpression(n.parent) || n.parent.expression !== n) {
            return;
          }
          const decl = p.declOf(n.name);
          if (decl && /typescript\/lib\/lib\./.test(decl.getSourceFile().fileName)) {
            out.push(p.finding(f, n.name, `chaîne \`.${n.name.text}(…)\` sur une promesse`));
          }
        });
      }
      return out;
    },
  },
  {
    id: 'F-EFFECT-01',
    rule: RULE.effects,
    sev: 'error',
    run: (p) => {
      const out = [];
      for (const f of p.under(isComponentFile)) {
        p.walk(f, (n) => {
          if (!ts.isCallExpression(n) || !/^(React\.)?use(Layout)?Effect$/.test(n.expression.getText(f.sf))) {
            return;
          }
          const cb = n.arguments[0];
          if (!isFunctionLike(cb)) {
            return;
          }
          const scan = (node) => {
            if (ts.isFunctionDeclaration(node)) {
              out.push(p.finding(f, node, `fonction \`${node.name?.text}\` dans l'effet`));
            }
            if (ts.isVariableDeclaration(node) && isFunctionLike(node.initializer)) {
              out.push(p.finding(f, node, `\`${node.name.getText(f.sf)}\` déclarée dans l'effet`));
            }
            if (isFunctionLike(node) || ts.isFunctionDeclaration(node)) {
              return; // callbacks passed to calls keep their own body
            }
            ts.forEachChild(node, scan);
          };
          ts.forEachChild(cb.body, scan);
        });
      }
      return out;
    },
  },
  {
    id: 'F-CB-01',
    rule: RULE.callbacks,
    sev: 'warn',
    run: (p) => {
      const out = [];
      for (const f of p.under(isComponentFile)) {
        p.walk(f, (n) => {
          if (!ts.isJsxAttribute(n) || !/^on[A-Z]/.test(n.name.getText(f.sf))) {
            return;
          }
          const expr = n.initializer && ts.isJsxExpression(n.initializer) ? n.initializer.expression : null;
          if (!expr || !ts.isIdentifier(expr) || expr.text.startsWith('handle')) {
            return;
          }
          const decl = p.declOf(expr);
          if (!decl || decl.getSourceFile() !== f.sf) {
            return;
          }
          const local =
            ts.isFunctionDeclaration(decl) ||
            (ts.isVariableDeclaration(decl) &&
              (isFunctionLike(decl.initializer) ||
                /^(React\.)?useCallback\b/.test(decl.initializer?.getText(f.sf) ?? '')));
          if (local) {
            out.push(p.finding(f, n, `\`${expr.text}\` est passé à ${n.name.getText(f.sf)} sans le préfixe handle`));
          }
        });
      }
      return out;
    },
  },
  {
    id: 'F-STYLE-01',
    rule: RULE.structure,
    sev: 'warn',
    run: (p) => {
      const out = [];
      const isLiteral = (e) =>
        ts.isNumericLiteral(e) ||
        ts.isStringLiteral(e) ||
        (ts.isPrefixUnaryExpression(e) && ts.isNumericLiteral(e.operand));
      for (const f of p.under(isComponentFile)) {
        p.walk(f, (n) => {
          if (!ts.isJsxAttribute(n) || n.name.getText(f.sf) !== 'style') {
            return;
          }
          const expr = n.initializer && ts.isJsxExpression(n.initializer) ? n.initializer.expression : null;
          if (expr && ts.isObjectLiteralExpression(expr) && expr.properties.length > 0) {
            if (expr.properties.every((prop) => ts.isPropertyAssignment(prop) && isLiteral(prop.initializer))) {
              out.push(p.finding(f, n, `style fixe \`${expr.getText(f.sf).replace(/\s+/g, ' ')}\``));
            }
          }
        });
      }
      return out;
    },
  },
  {
    id: 'F-COMMENT-01',
    rule: RULE.structure,
    sev: 'warn',
    run: (p) => {
      const code =
        /^\s*\/\/\s*(import |export |const |let |return\b|await |if \(|<\/?[A-Z]\w*|[\w.]+\(.*\);\s*$|\}\)?;?\s*$)/;
      const out = [];
      for (const f of p.appUnder((rel) => /\.tsx?$/.test(rel))) {
        f.lines.forEach((line, i) => {
          if (code.test(line) && !BANNER.test(line) && !/TODO|audit-ignore/.test(line)) {
            out.push({ file: f.rel, line: i + 1, msg: `ligne de code en commentaire : \`${line.trim()}\`` });
          }
        });
      }
      return out;
    },
  },
  {
    id: 'F-DEAD-01',
    rule: RULE.cleanup,
    sev: 'info',
    run: (p) => {
      const indegree = new Map();
      for (const node of p.nodes.values()) {
        for (const target of node.edges) {
          indegree.set(target, (indegree.get(target) ?? 0) + 1);
        }
      }
      const roots = /^(App\.tsx|index\.|app\.config\.ts|metro|babel|tailwind|nativewind)/;
      const out = [];
      for (const node of p.nodes.values()) {
        const file = node.loc.file;
        if (indegree.get(node.id) || node.name === '<module>' || roots.test(file) || !/\.tsx?$/.test(file)) {
          continue;
        }
        // Stack-owned code, and the stack keys / redirect enums every `{section}.types.ts` declares by convention.
        if (
          isStackOwned(file) ||
          (/^navigation\/.*\.types\.ts$/.test(file) && /^E\w*Stack(Redirect)?$/.test(node.name))
        ) {
          continue;
        }
        out.push({ file, line: node.loc.line, msg: `\`${node.name}\` n'est utilisé nulle part` });
      }
      return out;
    },
  },
];
