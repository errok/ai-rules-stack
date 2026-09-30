#!/usr/bin/env node

/**
 * Part 1 — which Go back routes each screen reaches, directly or through any depth of components,
 * hooks, stores and helpers. Writes tmp/api/api-map.md.
 *
 *   npm run api:map          # the app's script: node sub-modules/ai-rules-stack/audit/react-native/api-map.mjs
 *   AUDIT_BACK_DIR=/path/to/back npm run api:map   # default: ../<app>-back
 */
import { cell, code, header, link, loadAll, writeReport } from './lib/shared.mjs';

const ctx = loadAll();
const { nodes, routes, calls } = ctx;

const callsByNode = new Map();
for (const call of calls) {
  callsByNode.set(call.nodeId, [...(callsByNode.get(call.nodeId) ?? []), call]);
}

const isScreen = (node) => /^screens\/.*Screen\.tsx$/.test(node.loc.file) && /Screen$|^default$/.test(node.name);
const screens = [...nodes.values()].filter(isScreen).sort((a, b) => a.loc.file.localeCompare(b.loc.file));

// ─── Reachability ────────────────────────────────────────────────────────────
// reach(id): Map<apiNodeId, { min, max, paths, nextMin, nextMax }> — hops down to each function that calls
// `r` / `rPublic`. The walk stops at those functions; a cycle is cut where it closes.

const makeReach = (isCut) => {
  const memo = new Map();
  const inProgress = new Set();
  const reach = (id) => {
    if (memo.has(id)) {
      return memo.get(id);
    }
    const out = new Map();
    if (inProgress.has(id)) {
      return out;
    }
    inProgress.add(id);
    if (callsByNode.has(id)) {
      out.set(id, { min: 0, max: 0, paths: 1, nextMin: null, nextMax: null });
    } else {
      for (const next of nodes.get(id).edges) {
        if (isCut(next)) {
          continue;
        }
        for (const [sink, r] of reach(next)) {
          const cur = out.get(sink);
          if (!cur) {
            out.set(sink, { min: r.min + 1, max: r.max + 1, paths: r.paths, nextMin: next, nextMax: next });
            continue;
          }
          if (r.min + 1 < cur.min) {
            Object.assign(cur, { min: r.min + 1, nextMin: next });
          }
          if (r.max + 1 > cur.max) {
            Object.assign(cur, { max: r.max + 1, nextMax: next });
          }
          cur.paths += r.paths;
        }
      }
    }
    inProgress.delete(id);
    memo.set(id, out);
    return out;
  };
  return reach;
};

const reach = makeReach(() => false);
const screenIds = new Set(screens.map((s) => s.id));
const reachOutsideScreens = makeReach((id) => screenIds.has(id));

const chain = (reachFn, from, sink, which) => {
  const ids = [from];
  let cur = from;
  while (cur !== sink && ids.length < 50) {
    cur = reachFn(cur).get(sink)?.[which === 'max' ? 'nextMax' : 'nextMin'];
    if (!cur) {
      break;
    }
    ids.push(cur);
  }
  return ids;
};

// Short names in chains; the file is added only where a name is not unique.
const nameCount = new Map();
for (const node of nodes.values()) {
  nameCount.set(node.name, (nameCount.get(node.name) ?? 0) + 1);
}
const shortName = (id) => {
  const node = nodes.get(id);
  return nameCount.get(node.name) > 1 ? `${node.name} (${node.loc.file})` : node.name;
};
const chainText = (ids) => ids.map(shortName).join(' → ');

/** Declarations between the screen and its API functions (the screen and the API functions excluded). */
const involvedCount = (from) => {
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    const id = queue.shift();
    if (callsByNode.has(id)) {
      continue;
    }
    for (const next of nodes.get(id).edges) {
      if (!seen.has(next) && reach(next).size > 0) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return [...seen].filter((id) => id !== from && !callsByNode.has(id)).length;
};

const endpointLabel = (call) =>
  code(call.route ? `${call.route.method} ${call.route.path}` : `${call.http.method} ${call.http.url ?? '?'}`);
const handlerLink = (call) =>
  call.route ? link(ctx, call.route.handler?.loc ?? call.route.routeLoc, call.route.handlerName) : '❌ no back route';
const apiLink = (id) => link(ctx, nodes.get(id).loc, nodes.get(id).name);

// ─── Per screen ──────────────────────────────────────────────────────────────

const screenRows = screens.map((screen) => {
  const sinks = [...reach(screen.id)].sort((a, b) => b[1].max - a[1].max || a[0].localeCompare(b[0]));
  const endpoints = new Set(sinks.flatMap(([sink]) => callsByNode.get(sink).map((c) => c.key ?? c.http.url)));
  return {
    screen,
    sinks,
    endpoints: endpoints.size,
    maxDepth: Math.max(0, ...sinks.map(([, r]) => r.max)),
    paths: sinks.reduce((sum, [, r]) => sum + r.paths, 0),
    involved: sinks.length ? involvedCount(screen.id) : 0,
  };
});

const out = [header('API map — screens → back routes', 'npm run api:map', ctx)];

out.push(
  'A chain reads "this declaration references the next one": a call, a JSX render, a hook or a store read. ' +
    'It ends on the front function that calls `r` / `rPublic`, then on the gin handler of the route. ' +
    '**Depth** counts the hops from the screen to that function (min–max over every path); **paths** counts ' +
    'the distinct paths; **declarations** counts the components, hooks, stores and helpers they go through. ' +
    'Navigation to another screen is not a reference: each screen only carries what it renders and calls itself.',
  '',
);

// ─── Gaps ────────────────────────────────────────────────────────────────────

const calledKeys = new Set(calls.map((c) => c.key));
const unmatched = calls.filter((c) => !c.route);
const uncalled = routes.filter((r) => !calledKeys.has(r.key));
const reachedByScreens = new Set(screens.flatMap((s) => [...reach(s.id).keys()]));
const unreachedApis = [...callsByNode.keys()].filter((id) => !reachedByScreens.has(id));

out.push(
  '## Summary',
  '',
  `- ${screens.length} screens, ${screenRows.filter((r) => r.sinks.length).length} reach the API`,
  `- ${callsByNode.size} front API functions (${calls.length} HTTP calls) · ${routes.length} back routes`,
  `- ${unmatched.length} front call(s) without a back route · ${uncalled.length} back route(s) never called · ` +
    `${unreachedApis.length} API function(s) no screen reaches`,
  '',
);

out.push('## Gaps', '');
out.push('### Front calls without a back route', '');
out.push(
  ...(unmatched.length
    ? unmatched.map((c) => `- ❌ ${endpointLabel(c)} — ${apiLink(c.nodeId)} (${link(ctx, c.http.loc)})`)
    : ['None.']),
  '',
);
out.push('### Back routes the front never calls', '');
out.push(
  ...(uncalled.length
    ? uncalled.map(
        (r) => `- ${code(`${r.method} ${r.path}`)} — ${link(ctx, r.handler?.loc ?? r.routeLoc, r.handlerName)}`,
      )
    : ['None.']),
  '',
);
out.push('### API functions no screen reaches', '');
if (unreachedApis.length === 0) {
  out.push('None.', '');
} else {
  const indegree = new Map();
  for (const node of nodes.values()) {
    for (const next of node.edges) {
      indegree.set(next, (indegree.get(next) ?? 0) + 1);
    }
  }
  for (const id of unreachedApis) {
    const roots = [...nodes.values()].filter((n) => !indegree.get(n.id) && n.id !== id && reach(n.id).has(id));
    const via = roots.length
      ? roots.map((root) => chainText(chain(reach, root.id, id, 'min'))).join(' · ')
      : 'never referenced — dead code?';
    out.push(`- ${apiLink(id)} (${callsByNode.get(id).map(endpointLabel).join(', ')}) — ${via}`);
  }
  out.push('');
}

// ─── Complexity table ────────────────────────────────────────────────────────

out.push('## Screens by complexity', '');
out.push('| Screen | Endpoints | Depth max | Paths | Declarations |', '|---|---|---|---|---|');
for (const row of [...screenRows].sort((a, b) => b.maxDepth - a.maxDepth || b.paths - a.paths)) {
  out.push(
    `| ${link(ctx, row.screen.loc, shortName(row.screen.id))} | ${row.endpoints} | ${row.maxDepth} | ${row.paths} | ${row.involved} |`,
  );
}
out.push('');

// ─── Screens ─────────────────────────────────────────────────────────────────

out.push('## Screens', '');
for (const row of screenRows) {
  out.push(`### ${link(ctx, row.screen.loc, shortName(row.screen.id))}`, '');
  if (!row.sinks.length) {
    out.push('No API call.', '');
    continue;
  }
  out.push('| Endpoint | Front | Back handler | Depth | Paths |', '|---|---|---|---|---|');
  for (const [sink, r] of row.sinks) {
    for (const call of callsByNode.get(sink)) {
      const depth = r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`;
      out.push(`| ${endpointLabel(call)} | ${apiLink(sink)} | ${handlerLink(call)} | ${depth} | ${r.paths} |`);
    }
  }
  out.push('');
  for (const [sink, r] of row.sinks) {
    out.push(`- ${cell(chainText(chain(reach, row.screen.id, sink, 'max')))}`);
    if (r.min !== r.max) {
      out.push(`  - shortest: ${cell(chainText(chain(reach, row.screen.id, sink, 'min')))}`);
    }
  }
  out.push('');
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

out.push('## Endpoints', '');
const byKey = new Map();
for (const call of calls) {
  const key = call.key ?? call.http.url ?? '?';
  byKey.set(key, [...(byKey.get(key) ?? []), call]);
}
for (const [, group] of [...byKey].sort((a, b) => a[0].localeCompare(b[0]))) {
  const first = group[0];
  out.push(`### ${endpointLabel(first)}`, '');
  out.push(`- Back: ${handlerLink(first)}${first.route ? ` · route ${link(ctx, first.route.routeLoc)}` : ''}`);
  out.push(`- Front: ${group.map((c) => `${apiLink(c.nodeId)} (${c.http.client})`).join(', ')}`);
  const reachedBy = screens.filter((s) => group.some((c) => reach(s.id).has(c.nodeId)));
  out.push(`- Screens: ${reachedBy.length ? reachedBy.map((s) => shortName(s.id)).join(', ') : '—'}`);

  // Entry points that reach it without going through a screen (bootstrap, navigation, stores…).
  const outside = [...nodes.values()].filter(
    (n) => !screenIds.has(n.id) && !callsByNode.has(n.id) && group.some((c) => reachOutsideScreens(n.id).has(c.nodeId)),
  );
  const outsideRoots = outside.filter((n) => !outside.some((m) => m.edges.has(n.id)));
  if (outsideRoots.length) {
    const sink = group[0].nodeId;
    out.push(
      `- Also outside screens: ${outsideRoots.map((n) => cell(chainText(chain(reachOutsideScreens, n.id, sink, 'min')))).join(' · ')}`,
    );
  }

  const backQueries = first.route?.handler?.queries ?? [];
  const frontQueries =
    first.http.method === 'GET' && first.http.data?.shape.kind === 'object'
      ? [...first.http.data.shape.fields.keys()]
      : [];
  if (backQueries.length || frontQueries.length) {
    out.push(
      `- Query params: back ${backQueries.map(code).join(', ') || '—'} · front ${frontQueries.map(code).join(', ') || '—'}`,
    );
  }
  out.push('');
}

const path = writeReport('api-map.md', out.join('\n'));
console.info(`→ ${path}`);
console.info(
  `  ${screens.length} screens · ${callsByNode.size} API functions · ${routes.length} routes · ` +
    `${unmatched.length} unmatched call(s) · ${uncalled.length} uncalled route(s) · ${unreachedApis.length} unreached API function(s)`,
);
