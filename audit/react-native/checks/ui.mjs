/** Checks on the UI layer: Tailwind classes, design system, SVG icons, navigation. */

import ts from 'typescript';

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { classAttributes, isComponentFile } from '../lib/engine.mjs';

const RULE = {
  architecture: 'stack/core-rules/project-architecture-always.md',
  gap: 'stack/component-rules/nativewind-gap-spacing-auto.md',
  noOverride: 'stack/component-rules/ds-no-product-override-auto.md',
  newDs: 'stack/component-rules/ds-new-component-auto.md',
  structure: 'stack/component-rules/component-screen-structure-auto.md',
  padding: 'stack/component-rules/ds-container-scrollview-padding-auto.md',
  icon: 'stack/component-rules/ds-icon-auto.md',
  modal: 'stack/component-rules/ds-modal-auto.md',
  picto: 'stack/ui-rules/picto-components-auto.md',
  svg: 'stack/ui-rules/svg-assets-auto.md',
  navigation: 'stack/stack-rules/react-navigation-auto.md',
};

const tagName = (f, n) => (ts.isJsxElement(n) ? n.openingElement.tagName : n.tagName).getText(f.sf);

const attr = (f, n, name) => {
  const opening = ts.isJsxElement(n) ? n.openingElement : n;
  return opening.attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText(f.sf) === name) ?? null;
};

/** A boolean JSX prop is on when present without value or set to `{true}`. */
const isOn = (a) => a && (!a.initializer || a.initializer.expression?.kind === ts.SyntaxKind.TrueKeyword);

const listFiles = (dir, pattern) => {
  const out = [];
  const walk = (d) => {
    let names = [];
    try {
      names = readdirSync(d);
    } catch {
      return;
    }
    for (const name of names) {
      const path = join(d, name);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else if (pattern.test(name)) {
        out.push(path);
      }
    }
  };
  walk(dir);
  return out;
};

export const uiChecks = [
  // ─── Tailwind ──────────────────────────────────────────────────────────────
  {
    id: 'F-TW-01',
    rule: RULE.gap,
    sev: 'error',
    run: (p) => {
      const out = [];
      for (const f of p.under((rel) => /\.tsx$/.test(rel))) {
        for (const { node, tokens } of classAttributes(p, f)) {
          const bad = tokens.filter((t) => /^(space|gap)-[xy]-/.test(t));
          if (bad.length) {
            out.push(p.finding(f, node, `classe(s) à remplacer : ${bad.map((t) => `\`${t}\``).join(', ')}`));
          }
        }
      }
      return out;
    },
  },
  {
    id: 'F-TW-02',
    rule: RULE.gap,
    sev: 'warn',
    run: (p) => {
      const out = [];
      for (const f of p.under(isComponentFile)) {
        for (const { node, tokens } of classAttributes(p, f)) {
          const flex = tokens.some((t) => /^flex(-row|-col)?(-reverse)?$/.test(t));
          if (tokens.some((t) => /^gap-\d/.test(t)) && !flex) {
            out.push(p.finding(f, node, `gap sans flex dans \`${tokens.join(' ')}\``));
          }
        }
      }
      return out;
    },
  },
  {
    id: 'F-DS-02',
    rule: RULE.newDs,
    sev: 'error',
    run: (p) => {
      const out = [];
      for (const f of p.under('components/ds/', 'design-tokens/components/')) {
        p.walk(f, (n) => {
          if (
            (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) &&
            /#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(n.text)
          ) {
            out.push(p.finding(f, n, `couleur en dur \`${n.text}\``));
          }
        });
      }
      return out;
    },
  },
  {
    id: 'F-DS-03',
    rule: RULE.newDs,
    sev: 'error',
    run: (p) => {
      const out = [];
      for (const f of p.under('components/ds/')) {
        for (const st of f.sf.statements) {
          if (ts.isImportDeclaration(st) && /design-tokens\/primitives/.test(st.moduleSpecifier.getText(f.sf))) {
            out.push(p.finding(f, st, `importe ${st.moduleSpecifier.getText(f.sf)}`));
          }
        }
        for (const { node, tokens } of classAttributes(p, f)) {
          const bad = tokens.filter((t) => /-light-/.test(t));
          if (bad.length) {
            out.push(p.finding(f, node, `classe(s) du thème dans un Ds* : ${bad.map((t) => `\`${t}\``).join(', ')}`));
          }
        }
      }
      return out;
    },
  },
  {
    id: 'F-DS-04',
    rule: RULE.structure,
    sev: 'error',
    run: (p) => {
      const out = [];
      for (const f of p.under(isComponentFile)) {
        p.walk(f, (n) => {
          if (
            (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) &&
            tagName(f, n) === 'DsCard' &&
            attr(f, n, 'onPress')
          ) {
            out.push(p.finding(f, n, '`<DsCard onPress>`'));
          }
        });
      }
      return out;
    },
  },
  {
    id: 'F-DS-05',
    rule: RULE.padding,
    sev: 'error',
    run: (p) => {
      const out = [];
      for (const f of p.under('screens/')) {
        p.walk(f, (n) => {
          if (
            !(ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) ||
            tagName(f, n) !== 'DsScrollView' ||
            !isOn(attr(f, n, 'enablePadding'))
          ) {
            return;
          }
          for (let a = n.parent; a; a = a.parent) {
            if (ts.isJsxElement(a) && tagName(f, a) === 'DsContainer') {
              if (!isOn(attr(f, a, 'disablePadding'))) {
                out.push(p.finding(f, n, '`DsScrollView enablePadding` dans un `DsContainer` qui a déjà son padding'));
              }
              break;
            }
          }
        });
      }
      return out;
    },
  },
  {
    id: 'F-DS-06',
    rule: RULE.icon,
    sev: 'warn',
    run: (p) => {
      const registry = p.byRel.get('components/ds/DsIcon.tsx');
      if (!registry) {
        return { skipped: '`components/ds/DsIcon.tsx` introuvable' };
      }
      const icons = new Set(
        registry.sf.statements
          .filter(ts.isImportDeclaration)
          .map((st) => st.moduleSpecifier.text)
          .filter((m) => m.endsWith('.svg')),
      );
      const out = [];
      for (const f of p.under((rel) => /^(screens|components)\//.test(rel) && !rel.startsWith('components/ds/'))) {
        for (const st of f.sf.statements) {
          if (ts.isImportDeclaration(st) && icons.has(st.moduleSpecifier.text)) {
            out.push(p.finding(f, st, `importe \`${st.moduleSpecifier.text}\``));
          }
        }
      }
      return out;
    },
  },
  {
    id: 'F-DS-07',
    rule: RULE.architecture,
    sev: 'warn',
    run: (p) => {
      const covered = new Set(['Text', 'ScrollView', 'FlatList', 'SectionList', 'Switch', 'Modal']);
      const out = [];
      for (const f of p.under(isComponentFile)) {
        for (const st of f.sf.statements) {
          if (!ts.isImportDeclaration(st)) {
            continue;
          }
          const mod = st.moduleSpecifier.text;
          const clause = st.importClause;
          // A type-only import (a ref typed `ScrollView`) renders nothing: only value imports count.
          if (
            mod === 'react-native' &&
            !clause?.isTypeOnly &&
            clause?.namedBindings &&
            ts.isNamedImports(clause.namedBindings)
          ) {
            const raw = clause.namedBindings.elements
              .filter((e) => !e.isTypeOnly)
              .map((e) => (e.propertyName ?? e.name).text)
              .filter((n) => covered.has(n));
            if (raw.length) {
              out.push(p.finding(f, st, `importe ${raw.map((n) => `\`${n}\``).join(', ')} depuis react-native`));
            }
          }
          if (mod === 'react-native-modal') {
            out.push(p.finding(f, st, 'importe `react-native-modal` directement'));
          }
        }
      }
      return out;
    },
  },
  {
    id: 'F-PICTO-01',
    rule: RULE.picto,
    sev: 'warn',
    run: (p) =>
      p
        .under((rel) => /Picto[^/]*\.tsx$/.test(rel) && !rel.startsWith('components/Picto/'))
        .map((f) => ({ file: f.rel, line: 1, msg: 'pictogramme hors de `components/Picto/`' })),
  },
  {
    id: 'F-SVG-01',
    rule: RULE.svg,
    sev: 'warn',
    run: (p) => {
      const out = [];
      for (const path of listFiles(join(p.root, 'assets', 'icons'), /\.svg$/)) {
        const svg = readFileSync(path, 'utf8');
        const rel = relative(p.root, path);
        const problems = [];
        const root = svg.match(/<svg\b[^>]*>/)?.[0] ?? '';
        if (!/\bcolor=["']#0{3}(0{3})?["']/i.test(root)) {
          problems.push('balise `<svg>` sans `color="#000000"`');
        }
        const paints = [...svg.matchAll(/\b(fill|stroke)=["']([^"']+)["']/g)]
          .map((m) => m[2])
          .filter((v) => !/^(currentColor|none)$/i.test(v));
        if (paints.length) {
          problems.push(`couleur en dur ${[...new Set(paints)].map((v) => `\`${v}\``).join(', ')}`);
        }
        if (problems.length) {
          out.push({ file: rel, line: 1, msg: problems.join(' · ') });
        }
      }
      return out;
    },
  },

  // ─── Navigation ────────────────────────────────────────────────────────────
  {
    id: 'F-NAV-01',
    rule: RULE.navigation,
    sev: 'error',
    run: (p) => {
      const out = [];
      for (const node of p.nodes.values()) {
        if (
          node.loc.file.startsWith('navigation/') &&
          /Navigator$/.test(node.name) &&
          !['BottomTabNavigator', 'RootNavigator'].includes(node.name)
        ) {
          out.push({ file: node.loc.file, line: node.loc.line, msg: `\`${node.name}\` finit par Navigator` });
        }
      }
      return out;
    },
  },
  {
    id: 'F-NAV-02',
    rule: RULE.navigation,
    sev: 'warn',
    run: (p) => {
      const out = [];
      for (const f of p.appUnder('screens/', 'components/', 'navigation/', 'hooks/')) {
        p.walk(f, (n) => {
          if (
            ts.isCallExpression(n) &&
            ts.isPropertyAccessExpression(n.expression) &&
            ['navigate', 'push', 'replace'].includes(n.expression.name.text) &&
            n.arguments[0] &&
            ts.isStringLiteral(n.arguments[0]) &&
            p.front.checker.getTypeAtLocation(n.expression.expression).getProperty('navigate')
          ) {
            out.push(p.finding(f, n, `route écrite en dur : \`${n.expression.name.text}('${n.arguments[0].text}')\``));
          }
        });
      }
      return out;
    },
  },
];
