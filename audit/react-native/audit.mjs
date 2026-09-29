#!/usr/bin/env node

/**
 * Stack audit — checks a React Native app against the scriptable part of the stack's .claude rules (and the
 * contract with its Go back when one sits next to it), prints each check as soon as it has run, with the
 * detail of what fails, and writes docs/reports/audit-stack.md for a human or an AI to act on.
 *
 * Run from the app root (the app's `make audit` does it, then runs the app's own audit when it has one):
 *   node sub-modules/ai-rules-stack/audit/react-native/audit.mjs
 *
 * Settings, all optional: AUDIT_BACK_DIR (default ../<app>-back), AUDIT_STACK_REF (default origin_stack/main).
 * Exits 1 while an error-level finding remains. Silence a legitimate finding on its line or the line above:
 * `// audit-ignore F-XXX-00: reason` (`{/* audit-ignore F-XXX-00: reason *\/}` in JSX).
 */
import { codeChecks } from './checks/code.mjs';
import { contractChecks } from './checks/contract.mjs';
import { TEXTS } from './checks/texts.mjs';
import { toolingChecks } from './checks/tooling.mjs';
import { uiChecks } from './checks/ui.mjs';
import { APP_NAME, createProject, runAudit } from './lib/engine.mjs';
import { loadAll } from './lib/shared.mjs';

/** Group title of a check id (F-<AREA>-NN), printed when the area changes. */
const GROUPS = {
  SVC: 'Services et stores',
  STORE: 'Services et stores',
  TS: 'TypeScript et nommage',
  NAME: 'TypeScript et nommage',
  BARREL: 'Structure des composants',
  SECT: 'Structure des composants',
  ASYNC: 'Structure des composants',
  EFFECT: 'Structure des composants',
  CB: 'Structure des composants',
  STYLE: 'Structure des composants',
  COMMENT: 'Ménage',
  DEAD: 'Ménage',
  TW: 'Espacements (Tailwind)',
  DS: 'Design system',
  PICTO: 'Design system',
  SVG: 'Design system',
  NAV: 'Navigation',
  API: 'Contrat avec le back',
  TOOL: 'Outillage',
};

console.info('Chargement du code (TypeScript) et des routes du back…\n');
const project = createProject(loadAll({ optionalBack: true }));

const errors = runAudit(project, {
  title: `Audit du stack React Native — ${APP_NAME}`,
  scope: 'stack',
  checks: [...codeChecks, ...uiChecks, ...contractChecks, ...toolingChecks],
  texts: TEXTS,
  groups: GROUPS,
  reportPath: 'docs/reports/audit-stack.md',
  notes: [
    "`components/ds/**` appartient à la stack : un point du DS se corrige sur la stack via `/promote-ds`, jamais dans l'app.",
    "Les règles propres à l'app sont vérifiées par son audit projet (`docs/reports/audit-project.md`), lancé juste après par `make audit` quand l'app en a un.",
    'Les points côté back sont dans le rapport du back (`make audit` dans son dépôt).',
  ],
});

process.exitCode = errors > 0 ? 1 : 0;
