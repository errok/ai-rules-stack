#!/usr/bin/env node

/**
 * Part 2 — do the front's request / response types match the Go structs the back binds and returns,
 * and which response fields does the app actually use? Writes docs/api/dto-check.md; exits 1 on ❌.
 *
 *   npm run api:dto          # the app's script: node sub-modules/ai-rules-stack/audit/react-native/dto-check.mjs
 *   AUDIT_BACK_DIR=/path/to/back npm run api:dto   # default: ../<app>-back
 */
import { buildContract } from './lib/contract.mjs';
import { code, header, link, loadAll, writeReport } from './lib/shared.mjs';

const ctx = loadAll();
const { nodes } = ctx;
const { units, usageByType } = buildContract(ctx);

const ICON = { error: '❌', warn: '⚠️', info: 'ℹ️' };

// ─── Report ──────────────────────────────────────────────────────────────────

const allIssues = [...units.values()].flatMap((u) => u.issues);
const count = (level) => allIssues.filter((i) => i.level === level).length;
const unusedRows = [...usageByType.values()].flatMap((u) => u.rows.filter((r) => r.status !== 'used'));

const endpointsText = (endpoints) =>
  endpoints
    .map(
      (e) =>
        `${code(e.label)} (${link(ctx, nodes.get(e.apiId).loc, nodes.get(e.apiId).name)} ↔ ${link(ctx, e.handler?.loc ?? e.route.routeLoc, e.route.handlerName)})`,
    )
    .join(', ');

const issueLine = (issue) => {
  const where = [
    issue.frontLoc && link(ctx, issue.frontLoc, 'front'),
    issue.backLoc && link(ctx, issue.backLoc, 'back'),
  ]
    .filter(Boolean)
    .join(' · ');
  return `- ${ICON[issue.level]} ${issue.path ? `${code(issue.path)} — ` : ''}${issue.message}${where ? ` (${where})` : ''}`;
};

const out = [header('DTO check — front types ↔ back structs', 'npm run api:dto', ctx)];
out.push(
  `${ICON.error} breaks or loses data at runtime · ${ICON.warn} works by luck, fragile · ${ICON.info} harmless difference. ` +
    'The back side is the JSON the Go structs produce (`json` tags, pointers = nullable, `omitempty` = may be absent, ' +
    '`binding:"required"`); the front side is the type given to `r<…>` and the type of its `data`. ' +
    'A nil Go slice is sent as `null`: the check assumes the mappers always build slices.',
  '',
  '## Summary',
  '',
  `- ${count('error')} ${ICON.error} · ${count('warn')} ${ICON.warn} · ${count('info')} ${ICON.info} over ${units.size} contracts`,
  `- ${unusedRows.filter((r) => r.status === 'not declared').length} field(s) sent but not declared in the front · ` +
    `${unusedRows.filter((r) => r.status === 'never used').length} declared but never used · ` +
    `${unusedRows.filter((r) => r.status === 'written only').length} written only`,
  '',
);

const sections = [
  ['Requests (body)', 'request'],
  ['Query strings', 'query'],
  ['Responses', 'response'],
];
for (const [title, kind] of sections) {
  const list = [...units.values()].filter((u) => u.kind === kind);
  if (!list.length) {
    continue;
  }
  out.push(`## ${title}`, '');
  const clean = list.filter((u) => !u.issues.some((i) => i.level !== 'info'));
  for (const unit of list.filter((u) => !clean.includes(u)).concat(clean)) {
    const name =
      kind === 'query'
        ? code(unit.endpoints[0].label)
        : `${code(unit.front?.typeName ?? '—')} ↔ ${code(unit.back?.typeName ?? '—')}`;
    const status = unit.issues.some((i) => i.level === 'error')
      ? ICON.error
      : unit.issues.some((i) => i.level === 'warn')
        ? ICON.warn
        : '✅';
    out.push(`### ${status} ${name}`, '', `Used by ${endpointsText(unit.endpoints)}`, '');
    const shown = unit.issues.filter(
      (i) => i.level !== 'info' || kind !== 'response' || !i.message.startsWith('envoyé par le back'),
    );
    out.push(...(shown.length ? shown.map(issueLine) : ['No difference.']), '');
  }
}

out.push(
  '## Field usage (over-fetching)',
  '',
  'Every field the back sends, per front response type. **not declared**: sent but absent from the front type ' +
    '(pure payload weight). **never used**: declared but referenced nowhere. **written only**: only assigned ' +
    '(optimistic updates, mocks), never read. "Used" counts references found by the TypeScript language service ' +
    'on the declared property — a field copied through a spread into another type is not followed, check before dropping it.',
  '',
);
for (const [typeName, usage] of [...usageByType].sort((a, b) => a[0].localeCompare(b[0]))) {
  const used = usage.rows.filter((r) => r.status === 'used').length;
  out.push(
    `### ${code(typeName)} — ${used}/${usage.rows.length} fields used`,
    '',
    `From ${[...new Set(usage.endpoints.map((e) => code(e.label)))].join(', ')}`,
    '',
  );
  const notUsed = usage.rows.filter((r) => r.status !== 'used');
  if (!notUsed.length) {
    out.push('Every field is used.', '');
    continue;
  }
  out.push('| Field | Status | Back | Front |', '|---|---|---|---|');
  for (const row of notUsed) {
    out.push(
      `| ${code(row.path)} | ${row.status} | ${link(ctx, row.backLoc, 'struct')} | ${row.frontLoc ? link(ctx, row.frontLoc, 'type') : '—'} |`,
    );
  }
  out.push('');
}

const path = writeReport('dto-check.md', out.join('\n'));
console.info(`→ ${path}`);
console.info(
  `  ${count('error')} error(s) · ${count('warn')} warning(s) · ${unusedRows.length} field(s) sent but unused`,
);
process.exitCode = count('error') > 0 ? 1 : 0;
