/** Front ↔ Go back contract: the DTO / request comparison and the route gaps of `npm run api:map` / `api:dto`. */
import { relative } from 'node:path';
import { buildContract } from '../lib/contract.mjs';

const RULE = 'stack/service-rules/api-contract.md';

let cache = null;
const contractOf = (p) => {
  cache ??= buildContract(p);
  return cache;
};

const USAGE = {
  'not declared': 'envoyé par le back, absent du type front',
  'never used': 'déclaré dans le type front, jamais utilisé',
  'written only': 'seulement écrit, jamais lu',
};

const noBack = { skipped: 'back Go introuvable à côté de l’app (`../<app>-back`) — renseigner `AUDIT_BACK_DIR`' };

/** Front locations stay repo-relative; back ones become `../<back>/…`. */
const locFinding = (p, loc, msg) => {
  if (!loc) {
    return { file: '', line: 0, msg };
  }
  const file = loc.repo === 'back' ? relative(p.root, `${p.backDir}/${loc.file}`) : loc.file;
  return { file, line: loc.line, msg };
};

const issuesOf = (p, level) => {
  const out = [];
  for (const unit of contractOf(p).units.values()) {
    const endpoints = [...new Set(unit.endpoints.map((e) => `\`${e.label}\``))].join(', ');
    const what =
      unit.kind === 'query' ? 'query' : `\`${unit.front?.typeName ?? '—'}\` ↔ \`${unit.back?.typeName ?? '—'}\``;
    for (const issue of unit.issues.filter((i) => i.level === level)) {
      const path = issue.path ? ` \`${issue.path}\`` : '';
      out.push(locFinding(p, issue.frontLoc ?? issue.backLoc, `${what}${path} — ${issue.message} (${endpoints})`));
    }
  }
  return out;
};

export const contractChecks = [
  {
    id: 'F-API-01',
    rule: RULE,
    sev: 'error',
    run: (p) => (p.backDir ? issuesOf(p, 'error') : noBack),
  },
  {
    id: 'F-API-02',
    rule: RULE,
    sev: 'warn',
    run: (p) => (p.backDir ? issuesOf(p, 'warn') : noBack),
  },
  {
    id: 'F-API-03',
    rule: RULE,
    sev: 'error',
    run: (p) => {
      if (!p.backDir) {
        return noBack;
      }
      return p.calls
        .filter((c) => c.key && !c.route)
        .map((c) => locFinding(p, c.http.loc, `\`${c.http.method} ${c.http.url}\` n'a pas de route dans le back`));
    },
  },
  {
    id: 'F-API-04',
    rule: RULE,
    sev: 'info',
    run: (p) => {
      if (!p.backDir) {
        return noBack;
      }
      const out = [];
      for (const [typeName, usage] of contractOf(p).usageByType) {
        for (const row of usage.rows.filter((r) => r.status !== 'used')) {
          out.push(
            locFinding(
              p,
              row.frontLoc ?? row.backLoc,
              `\`${typeName}.${row.path}\` — ${USAGE[row.status] ?? row.status}`,
            ),
          );
        }
      }
      return out;
    },
  },
  {
    id: 'F-API-05',
    rule: RULE,
    sev: 'info',
    run: (p) => {
      if (!p.backDir) {
        return noBack;
      }
      const called = new Set(p.calls.map((c) => c.key));
      return p.routes
        .filter((r) => r.path.startsWith('/api/') && !called.has(r.key))
        .map((r) => locFinding(p, r.routeLoc, `\`${r.method} ${r.path}\` (${r.handlerName}) n'est jamais appelée`));
    },
  },
];
