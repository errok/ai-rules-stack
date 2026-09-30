/**
 * Audit engine shared by the stack audit (audit.mjs) and a project's own audit (the app's
 * scripts/audit/audit.mjs): what every check works on (the app's TypeScript program, its call graph, the
 * back routes when the Go back is found), how a check reports, and how an audit prints and writes its report.
 * The output is in French, for the team.
 */

import ts from 'typescript';

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { APP_NAME, FRONT_ROOT } from './shared.mjs';

export { APP_NAME, FRONT_ROOT };

/** Status shown for a failing check, by severity. */
export const STATUS = { error: '❌ ERREUR', warn: '🟠 À VÉRIFIER', info: '🔵 SUGGESTION' };
const SKIPPED = '⏭️  NON LANCÉ';
const MEANING = {
  error: 'à corriger avant la release',
  warn: "à corriger, ou à justifier avec `audit-ignore` si c'est voulu",
  info: 'ménage, rien de bloquant',
};

const places = (n) => (n === 1 ? '1 endroit' : `${n} endroits`);

/** Places printed in the terminal for a suggestion; errors and checks to review print them all. */
const CONSOLE_DETAIL_LIMIT = 5;

// ─── Project ─────────────────────────────────────────────────────────────────

export const createProject = (ctx) => {
  const { front } = ctx;
  const files = front.sourceFiles.map((sf) => ({ sf, rel: front.rel(sf.fileName), lines: sf.text.split('\n') }));
  const byRel = new Map(files.map((f) => [f.rel, f]));

  const lineOf = (sf, node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

  return {
    ...ctx,
    root: FRONT_ROOT,
    files,
    byRel,
    lineOf,
    /** Project files whose path starts with one of the prefixes (or matches the predicate). */
    under: (...prefixes) =>
      files.filter((f) => prefixes.some((p) => (typeof p === 'function' ? p(f.rel) : f.rel.startsWith(p)))),
    /** Same as `under`, without the stack-owned DS code. */
    appUnder: (...prefixes) =>
      files.filter(
        (f) => !isStackOwned(f.rel) && prefixes.some((p) => (typeof p === 'function' ? p(f.rel) : f.rel.startsWith(p))),
      ),
    /** Visits every node of a file. */
    walk: (file, visit) => {
      const go = (node) => {
        visit(node);
        ts.forEachChild(node, go);
      };
      go(file.sf);
    },
    finding: (file, node, msg) => ({ file: file.rel, line: node ? lineOf(file.sf, node) : 0, msg }),
    /** Declaration the identifier resolves to, through imports. */
    declOf: (identifier) => {
      let symbol = front.checker.getSymbolAtLocation(identifier);
      if (symbol && symbol.flags & ts.SymbolFlags.Alias) {
        symbol = front.checker.getAliasedSymbol(symbol);
      }
      return symbol?.declarations?.[0] ?? null;
    },
  };
};

/** Stack-owned code (DS and its debug labs): fixed on the stack through /promote-ds, not in the app. */
export const isStackOwned = (rel) => rel.startsWith('components/ds/') || rel.startsWith('components/_devDebugMenu/');

export const isComponentFile = (rel) => /\.tsx$/.test(rel) && /^(screens|components)\//.test(rel) && !isStackOwned(rel);

/** Text of a JSX attribute's string value(s): `className="…"`, `className={'…'}`, template or `cn('…', …)` pieces. */
export const stringsIn = (node) => {
  const out = [];
  const go = (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      out.push({ node: n, text: n.text });
    } else if (ts.isTemplateExpression(n)) {
      out.push({ node: n, text: [n.head.text, ...n.templateSpans.map((s) => s.literal.text)].join(' ') });
    }
    ts.forEachChild(n, go);
  };
  go(node);
  return out;
};

/** Every className-like attribute of a file: { node, tokens } with the variant prefix (`sm:`) stripped. */
export const classAttributes = (p, f) => {
  const out = [];
  p.walk(f, (n) => {
    if (!ts.isJsxAttribute(n) || !/className$/i.test(n.name.getText(f.sf)) || !n.initializer) {
      return;
    }
    const tokens = stringsIn(n.initializer)
      .flatMap((s) => s.text.split(/\s+/))
      .filter(Boolean)
      .map((t) => t.slice(t.lastIndexOf(':') + 1));
    out.push({ node: n, tokens });
  });
  return out;
};

// ─── Ignoring ────────────────────────────────────────────────────────────────

/** A compiler or linter error is fixed, never silenced. */
const ignorable = (id) => !id.includes('-TOOL-');

/** How to mark a finding as intended, with the exact comment to copy. */
export const ignoreHint = (check) =>
  ignorable(check.id) ? `\`// audit-ignore ${check.id}: <raison>\`` : 'impossible, il faut corriger.';

/**
 * Whether `audit-ignore <id>` silences the finding: on its line or the line above, or anywhere in the file for a
 * finding without a line. Files outside the TypeScript program (SVG, JSON…) are read from disk.
 */
const ignored = (project, finding, id) => {
  if (!finding.file || finding.file.startsWith('../') || !ignorable(id)) {
    return false;
  }
  let lines = project.byRel.get(finding.file)?.lines;
  if (!lines) {
    try {
      lines = readFileSync(join(FRONT_ROOT, finding.file), 'utf8').split('\n');
    } catch {
      return false;
    }
  }
  const marks = (line) => line?.includes('audit-ignore') && line.includes(id);
  if (!finding.line) {
    return lines.some(marks);
  }
  return [finding.line - 1, finding.line - 2].some((n) => n >= 0 && marks(lines[n]));
};

// ─── Audit ───────────────────────────────────────────────────────────────────

const plain = (text) => String(text).replace(/`/g, '');

const gitState = (dir) => {
  try {
    const sha = execSync('git rev-parse --short HEAD', { cwd: dir, encoding: 'utf8' }).trim();
    const dirty = execSync('git status --porcelain', { cwd: dir, encoding: 'utf8' }).trim() !== '';
    return `\`${sha}\`${dirty ? ' + modifications non commitées' : ''}`;
  } catch {
    return 'inconnu';
  }
};

/** Rule files under .claude/rules/<scope> (the stack folder is a symlink), as `<scope>/…/x.md`. */
const listRules = (scope) => {
  const base = join(FRONT_ROOT, '.claude', 'rules', scope);
  if (!existsSync(base)) {
    return [];
  }
  const dir = realpathSync(base);
  const rules = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const path = join(d, name);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else if (name.endsWith('.md') && !['README.md', 'STACK.md'].includes(name)) {
        rules.push(`${scope}/${relative(dir, path).split(sep).join('/')}`);
      }
    }
  };
  walk(dir);
  return rules.sort();
};

// ─── Options and help ────────────────────────────────────────────────────────

const SEV_ICON = { error: '❌', warn: '🟠', info: '🔵' };

/** `-h` / `--help` and `-v` / `--verbose`; anything else is returned in `unknown`. */
export const parseArgs = (argv = process.argv.slice(2)) => {
  const options = { help: false, verbose: false, unknown: [] };
  for (const arg of argv) {
    if (arg === '-h' || arg === '--help') {
      options.help = true;
    } else if (arg === '-v' || arg === '--verbose') {
      options.verbose = true;
    } else {
      options.unknown.push(arg);
    }
  }
  return options;
};

/**
 * What the audit does, its options, then every check on one line: reference, severity when it fails, subject
 * and what is expected. Needs no project: printed before the code is loaded.
 *
 * meta: { description, usage: [lines], settings: [lines] }
 */
export const printHelp = (config, { description, usage, settings = [] }) => {
  const { title, checks, texts, groups } = config;
  console.info(`${title}\n`);
  console.info(`${description}\n`);
  console.info('Usage :');
  for (const line of usage) {
    console.info(`  ${line}`);
  }
  console.info('\nOptions :');
  console.info('  -h, --help      affiche cette aide, sans lancer l’audit');
  console.info(
    '  -v, --verbose   affiche tous les points, y compris ceux qui sont OK (par défaut : seulement ceux à traiter)',
  );
  if (settings.length) {
    console.info('\nRéglages (variables d’environnement, facultatifs) :');
    for (const line of settings) {
      console.info(`  ${line}`);
    }
  }
  console.info(
    `\nPoints vérifiés (${checks.length}) — gravité en cas d’échec : ❌ erreur · 🟠 à vérifier · 🔵 suggestion`,
  );
  let lastGroup = null;
  for (const check of checks) {
    const group = groups[check.id.split('-')[1]] ?? '';
    if (group !== lastGroup) {
      console.info(`\n  ${group}`);
      lastGroup = group;
    }
    const text = texts[check.id];
    console.info(`    ${check.id.padEnd(12)} ${SEV_ICON[check.sev]} ${plain(text.title)} — ${plain(text.expected)}`);
  }
};

/**
 * Runs one audit: prints each check as soon as it has run, writes the report, prints the summary.
 * By default only the checks that are not OK are printed; `verbose` prints every check too. The report is
 * always complete.
 *
 * config: {
 *   title,        e.g. 'Audit du stack React Native — shooter'
 *   scope,        'stack' | 'project': which rule folder is listed under "Règles sans vérification automatique"
 *   checks,       [{ id, rule, sev: 'error' | 'warn' | 'info', run(project) → findings | { skipped } }]
 *   texts,        { [id]: { title, expected, why, fix } } — French wording of each check
 *   groups,       { [AREA]: title } — AREA is the middle part of an id (F-<AREA>-NN)
 *   reportPath,   relative to the app root
 *   notes,        extra bullets for "Comment traiter ce rapport"
 * }
 * Returns the number of error-level findings.
 */
export const runAudit = (project, config, { verbose = false } = {}) => {
  const { title, scope, checks, texts, groups, reportPath, notes = [] } = config;
  const textOf = (check) => {
    const text = texts[check.id];
    if (!text) {
      throw new Error(`no wording for check ${check.id}`);
    }
    return text;
  };
  const exampleId = checks[0]?.id ?? 'X-AREA-01';

  // Header
  console.info(`${title}\n`);
  console.info('Statuts :');
  console.info('✅ OK');
  for (const sev of ['error', 'warn', 'info']) {
    console.info(`${STATUS[sev]} (${plain(MEANING[sev])})`);
  }
  console.info(`${SKIPPED.replace(/ +/g, ' ')} (le point n'a pas pu être vérifié, la raison est indiquée)\n`);
  console.info(
    `La référence entre crochets (ex. [${exampleId}]) désigne le point dans le rapport, dans /audit et dans audit-ignore.`,
  );
  if (!verbose) {
    console.info('Seuls les points à traiter sont affichés — -v / --verbose pour voir aussi les points OK.');
  }

  // Checks, printed as they run
  let lastGroup = null;
  // Exactly one blank line around the detail block of a failing check.
  let afterBlock = false;
  let afterHeader = false;
  let printedAny = false;
  const printResult = ({ check, findings, skipped }) => {
    if (!verbose && !skipped && !findings.length) {
      return;
    }
    printedAny = true;
    const text = textOf(check);
    const group = groups[check.id.split('-')[1]] ?? '';
    if (group !== lastGroup) {
      const bar = '*'.repeat([...group].length);
      console.info(`\n${bar}\n${group}\n${bar}`);
      lastGroup = group;
      afterHeader = true;
      afterBlock = false;
    }
    if (skipped || !findings.length) {
      if (afterBlock) {
        console.info('');
      }
      console.info(
        skipped
          ? `  ${SKIPPED}  ${plain(text.title)}  [${check.id}] — ${plain(skipped)}`
          : `  ✅ OK  ${plain(text.title)}  [${check.id}]`,
      );
      afterHeader = false;
      afterBlock = false;
      return;
    }
    if (!afterHeader) {
      console.info('');
    }
    afterHeader = false;
    afterBlock = true;
    console.info(`  ${STATUS[check.sev]}  ${plain(text.title)}  [${check.id}] — ${places(findings.length)}`);
    console.info(`       Attendu          : ${plain(text.expected)}`);
    console.info(`       Pourquoi         : ${plain(text.why)}`);
    console.info('       Où               :');
    const shown = check.sev === 'info' ? findings.slice(0, CONSOLE_DETAIL_LIMIT) : findings;
    for (const f of shown) {
      const where = f.file ? `${f.file}${f.line ? `:${f.line}` : ''}` : '(projet)';
      console.info(`         • ${where} — ${plain(f.msg)}`);
    }
    if (shown.length < findings.length) {
      console.info(`         … et ${findings.length - shown.length} autre(s), voir le rapport`);
    }
    console.info(`       Comment corriger : ${plain(text.fix)}`);
    console.info(`       Pour ignorer     : ${plain(ignoreHint(check))}`);
  };

  const results = checks.map((check) => {
    let raw = [];
    try {
      raw = check.run(project);
    } catch (error) {
      raw = [{ file: '', line: 0, msg: `le point n'a pas pu être vérifié : ${error.message}` }];
    }
    let result;
    if (Array.isArray(raw)) {
      const findings = raw.filter((f) => !ignored(project, f, check.id));
      findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
      result = { check, findings, suppressed: raw.length - findings.length };
    } else {
      result = { check, findings: [], suppressed: 0, skipped: raw.skipped };
    }
    printResult(result);
    return result;
  });

  // Report
  const reportAbs = join(FRONT_ROOT, reportPath);
  const reportDir = dirname(reportAbs);
  const link = (absOrRel, line, label) => {
    const abs = absOrRel.startsWith('/') ? absOrRel : join(FRONT_ROOT, absOrRel);
    const target = relative(reportDir, abs).split(sep).join('/');
    return `[${label}](${target}${line ? `#L${line}` : ''})`;
  };
  const ruleLink = (rule) => link(join(FRONT_ROOT, '.claude', 'rules', rule), 0, rule);
  const failing = (sev) => results.filter((r) => r.check.sev === sev && r.findings.length).length;
  const ok = results.filter((r) => !r.findings.length && !r.skipped).length;
  const skippedCount = results.filter((r) => r.skipped).length;
  const suppressed = results.reduce((n, r) => n + r.suppressed, 0);
  const now = new Date();
  const date = `${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  const backState = project.backDir
    ? ` · back ${gitState(project.backDir)} (\`${relative(FRONT_ROOT, project.backDir)}\`)`
    : '';

  const out = [
    `# ${title}`,
    '',
    `> Généré par \`make audit\` le ${date} — ne pas modifier à la main, relancer la commande.`,
    `> Front ${gitState(FRONT_ROOT)}${backState}`,
    '',
    `**${results.length} points vérifiés : ✅ ${ok} OK · ❌ ${failing('error')} en erreur · 🟠 ${failing('warn')} à vérifier · 🔵 ${failing('info')} suggestion(s)${skippedCount ? ` · ⏭️ ${skippedCount} non lancé(s)` : ''}** · ${suppressed} cas écarté(s) par \`audit-ignore\`.`,
    '',
    '## Statuts',
    '',
    '| Statut | Signification |',
    '|---|---|',
    '| ✅ OK | la règle est respectée partout |',
    ...['error', 'warn', 'info'].map((sev) => `| ${STATUS[sev]} | ${MEANING[sev]} |`),
    `| ${SKIPPED.replace(/ +/g, ' ')} | le point n'a pas pu être vérifié (raison indiquée) |`,
    '',
    `La **référence** (\`${exampleId}\`…) est l'identifiant stable du point : elle relie la console, ce rapport, \`/audit\` et les commentaires \`audit-ignore\`.`,
    '',
    '## Comment traiter ce rapport',
    '',
    'Écrit pour qui corrige — un développeur ou une IA :',
    '',
    "- Chaque section du détail est un point en échec : ce qui est attendu, pourquoi, comment corriger, la règle d'origine (à lire avant de corriger), puis chaque endroit concerné en `fichier:ligne`.",
    "- Traiter dans l'ordre ❌ → 🟠 → 🔵, relancer `make audit` après chaque lot, ne jamais modifier ce rapport.",
    '- Un cas légitime se justifie dans le code, sur sa ligne ou la ligne au-dessus : `// audit-ignore <référence>: <raison>` (`{/* audit-ignore <référence>: <raison> */}` en JSX).',
    "- Supprimer du code (code mort, code commenté, champs inutilisés) demande l'accord de l'utilisateur : le proposer, ne pas le faire en silence.",
    ...notes.map((note) => `- ${note}`),
    '',
    "## Vue d'ensemble",
    '',
    '| Statut | Point vérifié | Référence | Règle | Endroits |',
    '|---|---|---|---|---|',
    ...results.map(({ check, findings, skipped }) => {
      const status = skipped ? SKIPPED.replace(/ +/g, ' ') : findings.length ? STATUS[check.sev] : '✅ OK';
      return `| ${status} | ${textOf(check).title} | \`${check.id}\` | ${ruleLink(check.rule)} | ${skipped ? '—' : findings.length} |`;
    }),
    '',
    '## Détail des points en échec',
    '',
  ];

  let any = false;
  for (const sev of ['error', 'warn', 'info']) {
    for (const { check, findings } of results) {
      if (check.sev !== sev || !findings.length) {
        continue;
      }
      any = true;
      const text = textOf(check);
      out.push(
        `### ${STATUS[sev]} — ${text.title} \`${check.id}\``,
        '',
        `- **Attendu :** ${text.expected}`,
        `- **Pourquoi :** ${text.why}`,
        `- **Comment corriger :** ${text.fix}`,
        `- **Pour ignorer :** ${ignoreHint(check)}`,
        `- **Règle :** ${ruleLink(check.rule)}`,
        `- **Où (${places(findings.length)}) :**`,
        '',
      );
      for (const f of findings) {
        const label = `${f.file}${f.line ? `:${f.line}` : ''}`;
        const where = !f.file
          ? '(projet)'
          : link(f.file.startsWith('../') ? join(FRONT_ROOT, f.file) : f.file, f.line, label);
        out.push(`  - ${where} — ${f.msg}`);
      }
      out.push('');
    }
  }
  if (!any) {
    out.push('Rien à corriger.', '');
  }

  const skippedResults = results.filter((r) => r.skipped);
  if (skippedResults.length) {
    out.push(
      '## Points non lancés',
      '',
      ...skippedResults.map((r) => `- ${textOf(r.check).title} \`${r.check.id}\` — ${r.skipped}`),
      '',
    );
  }

  const covered = new Set(results.map((r) => r.check.rule));
  out.push(
    '## Règles sans vérification automatique',
    '',
    `Aucun point ci-dessus ne couvre ces fichiers de règles (\`.claude/rules/${scope}\`) — à relire à la main avant une release :`,
    '',
    ...listRules(scope)
      .filter((rule) => !covered.has(rule))
      .map((rule) => `- ${ruleLink(rule)}`),
    '',
    "Une règle couverte garde aussi des consignes qu'aucun script ne peut juger (placement des composants, qualité des textes, choix de tokens) : couverte ne veut pas dire entièrement vérifiée.",
  );

  mkdirSync(reportDir, { recursive: true });
  writeFileSync(reportAbs, `${out.join('\n')}\n`);

  // Summary
  if (!verbose && !printedAny) {
    console.info('\n✅ Tous les points sont OK.');
  }
  console.info(
    `\nBilan : ${results.length} points vérifiés — ✅ ${ok} OK · ❌ ${failing('error')} en erreur · 🟠 ${failing('warn')} à vérifier · 🔵 ${failing('info')} suggestion(s)${skippedCount ? ` · ⏭️ ${skippedCount} non lancé(s)` : ''}`,
  );
  console.info(`Rapport détaillé : ${reportPath}`);

  return results.filter((r) => r.check.sev === 'error').reduce((n, r) => n + r.findings.length, 0);
};
