/**
 * The front ↔ back contract: each front request / response type compared with the Go struct the handler
 * binds or returns, and the usage of every response field in the app. Shared by `npm run api:dto` and the audit.
 */
import { buildTypeFlows, flowClosure, referencesOf } from './front.mjs';
import { code } from './shared.mjs';

export const describe = (shape) => {
  if (!shape) {
    return 'nothing';
  }
  const base =
    shape.kind === 'array'
      ? `${describe(shape.elem)}[]`
      : shape.kind === 'object'
        ? shape.name
        : (shape.label ?? shape.kind);
  return shape.nullable ? `${base} | null` : base;
};

/** units: one per (direction, front type, back type), each with its `issues`; usageByType: response field usage. */
export const buildContract = (ctx) => {
  const { front, calls } = ctx;

  // ─── Structural comparison ───────────────────────────────────────────────────
  // Responses are read back → front (what the back sends must fit the front type);
  // requests front → back (what the front sends must fit the struct gin binds).

  const compareShapes = (back, frontShape, path, mode, issues) => {
    const add = (level, message, locs = {}) => issues.push({ level, path, message, ...locs });
    if (back.kind === 'unknown') {
      add('info', `type du back non résolu (${back.label}) — non vérifié`);
      return;
    }
    if (frontShape.kind === 'unknown') {
      add('info', `type front ${code(frontShape.label)} impossible à vérifier`);
      return;
    }
    if (back.kind !== frontShape.kind && !(back.kind === 'map' && frontShape.kind === 'object')) {
      add('error', `types différents — back ${code(describe(back))}, front ${code(describe(frontShape))}`);
      return;
    }
    if (back.kind === 'array') {
      compareShapes(back.elem, frontShape.elem, `${path}[]`, mode, issues);
      return;
    }
    if (back.kind !== 'object' || frontShape.kind !== 'object') {
      return;
    }

    const join = (name) => (path ? `${path}.${name}` : name);
    for (const [name, b] of back.fields) {
      const f = frontShape.fields.get(name);
      const locs = { backLoc: b.loc, frontLoc: f?.loc };
      const at = (level, message) => issues.push({ level, path: join(name), message, ...locs });
      if (!f) {
        if (mode === 'response') {
          at('info', `envoyé par le back, absent de ${code(frontShape.name)}`);
        } else if (b.required) {
          at('error', `obligatoire pour le back (\`binding:"required"\`), jamais envoyé par le front`);
        } else {
          at('info', `accepté par le back, jamais envoyé par le front`);
        }
        continue;
      }
      if (mode === 'response') {
        if (b.shape.nullable && !f.shape.nullable) {
          if (f.optional) {
            at('warn', `le back envoie \`null\`, le front le type optionnel (\`?:\` → undefined) — ajouter \`| null\``);
          } else {
            at('error', `le back peut envoyer \`null\`, le type front ne l'accepte pas`);
          }
        }
        if (b.optional && !f.optional) {
          at('warn', "le back l'omet quand il est vide (`omitempty`), le front le type comme toujours présent");
        }
        if (!b.shape.nullable && f.shape.nullable) {
          at('info', "le front accepte `null`, le back ne l'envoie jamais");
        }
        if (!b.optional && !b.shape.nullable && f.optional) {
          at('info', 'optionnel côté front, toujours envoyé par le back');
        }
      } else {
        if (b.required && f.optional) {
          at('error', `obligatoire pour le back (\`binding:"required"\`), optionnel côté front`);
        }
        if (b.required && f.shape.nullable) {
          at('error', 'obligatoire pour le back, le front peut envoyer `null`');
        }
        if (f.shape.nullable && !b.shape.nullable && !['array', 'map'].includes(b.shape.kind)) {
          at('warn', "le front peut envoyer `null`, le champ Go n'est pas un pointeur (lu comme sa valeur zéro)");
        }
      }
      compareShapes(b.shape, f.shape, join(name), mode, issues);
    }
    for (const [name, f] of frontShape.fields) {
      if (back.fields.has(name)) {
        continue;
      }
      const locs = { frontLoc: f.loc, backLoc: back.loc };
      if (mode === 'response') {
        issues.push({
          level: f.optional ? 'warn' : 'error',
          path: join(name),
          message: `déclaré dans ${code(frontShape.name)}, jamais envoyé par le back`,
          ...locs,
        });
      } else {
        issues.push({
          level: 'error',
          path: join(name),
          message: `envoyé par le front, ignoré par le back (absent de ${code(back.name)})`,
          ...locs,
        });
      }
    }
  };

  // ─── Units ───────────────────────────────────────────────────────────────────
  // One unit per (direction, front type, back type): SessionDto is checked once, not once per endpoint.

  const units = new Map();
  const addUnit = (key, unit, endpoint) => {
    if (!units.has(key)) {
      units.set(key, { ...unit, endpoints: [] });
    }
    units.get(key).endpoints.push(endpoint);
  };

  for (const call of calls) {
    if (!call.route) {
      continue;
    }
    const handler = call.route.handler;
    const endpoint = {
      label: `${call.route.method} ${call.route.path}`,
      apiId: call.nodeId,
      handler,
      route: call.route,
    };
    const isGet = call.http.method === 'GET';

    // Response
    const backRes = handler?.response;
    const frontRes = call.http.response;
    addUnit(
      `res|${frontRes.typeName}|${backRes?.typeName}`,
      { kind: 'response', back: backRes, front: frontRes },
      endpoint,
    );

    // Body or query string
    if (isGet) {
      const sent = call.http.data?.shape.kind === 'object' ? [...call.http.data.shape.fields.keys()] : [];
      const read = handler?.queries ?? [];
      if (sent.length || read.length) {
        addUnit(`query|${endpoint.label}`, { kind: 'query', sent, read }, endpoint);
      }
    } else if (handler?.request || call.http.data) {
      addUnit(
        `req|${call.http.data?.typeName}|${handler?.request?.typeName}`,
        { kind: 'request', back: handler?.request ?? null, front: call.http.data },
        endpoint,
      );
    }
  }

  for (const unit of units.values()) {
    const issues = [];
    if (unit.kind === 'response') {
      const b = unit.back?.shape;
      const f = unit.front.shape;
      if (!b) {
        issues.push({ level: 'info', path: '', message: 'réponse du back introuvable dans le handler — non vérifié' });
      } else if (b.kind === 'void' && f.kind !== 'void') {
        issues.push({
          level: 'error',
          path: '',
          message: `le back répond sans corps, le front attend ${code(describe(f))}`,
        });
      } else if (b.kind !== 'void' && f.kind === 'void') {
        issues.push({
          level: 'info',
          path: '',
          message: `le back envoie ${code(describe(b))}, le front ignore le corps`,
        });
      } else if (b.kind !== 'void') {
        compareShapes(b, f, '', 'response', issues);
      }
    } else if (unit.kind === 'request') {
      if (!unit.front) {
        issues.push({
          level: 'error',
          path: '',
          message: `le back attend ${code(unit.back.typeName)}, le front n'envoie pas de corps`,
        });
      } else if (!unit.back) {
        issues.push({
          level: 'warn',
          path: '',
          message: `le front envoie ${code(unit.front.typeName)}, le back ne lit pas de corps`,
        });
      } else {
        compareShapes(unit.back.shape, unit.front.shape, '', 'request', issues);
      }
    } else {
      for (const key of unit.sent.filter((k) => !unit.read.includes(k))) {
        issues.push({ level: 'error', path: `?${key}`, message: 'envoyé par le front, non lu par le back' });
      }
      for (const key of unit.read.filter((k) => !unit.sent.includes(k))) {
        issues.push({ level: 'info', path: `?${key}`, message: 'lu par le back, jamais envoyé par le front' });
      }
    }
    unit.issues = issues;
  }

  // ─── Field usage (over-fetching) ─────────────────────────────────────────────

  const flows = buildTypeFlows(front);
  const refCache = new Map();
  const refsOf = (symbol) => {
    if (!refCache.has(symbol)) {
      refCache.set(symbol, referencesOf(front, symbol) ?? []);
    }
    return refCache.get(symbol);
  };

  /** References to the field on its own type and on every type a value of it flows into. */
  const fieldRefs = (objectShape, name, symbol) => {
    const refs = new Map(refsOf(symbol).map((r) => [`${r.file}:${r.line}`, r]));
    const via = new Set();
    for (const type of flowClosure(flows, objectShape.type)) {
      const prop = front.checker.getPropertyOfType(type, name);
      if (!prop || prop === symbol) {
        continue;
      }
      const more = refsOf(prop).filter((r) => !refs.has(`${r.file}:${r.line}`));
      if (more.some((r) => !r.isWrite)) {
        via.add((type.aliasSymbol ?? type.symbol)?.name ?? '?');
      }
      for (const r of more) {
        refs.set(`${r.file}:${r.line}`, r);
      }
    }
    return { refs: [...refs.values()], via: [...via] };
  };

  /** Rows for every field the back sends, walking nested objects and arrays. */
  const usageRows = (back, frontShape, path, rows) => {
    if (!back || back.kind === 'unknown') {
      return;
    }
    if (back.kind === 'array') {
      usageRows(back.elem, frontShape?.kind === 'array' ? frontShape.elem : null, path && `${path}[]`, rows);
      return;
    }
    if (back.kind !== 'object') {
      return;
    }
    for (const [name, b] of back.fields) {
      const fieldPath = path ? `${path}.${name}` : name;
      const f = frontShape?.kind === 'object' ? frontShape.fields.get(name) : null;
      if (!f) {
        rows.push({ path: fieldPath, status: 'not declared', backLoc: b.loc });
      } else {
        const { refs, via } = fieldRefs(frontShape, name, f.symbol);
        const reads = refs.filter((r) => !r.isWrite);
        const status = refs.length === 0 ? 'never used' : reads.length === 0 ? 'written only' : 'used';
        rows.push({ path: fieldPath, status, backLoc: b.loc, frontLoc: f.loc, via });
      }
      usageRows(b.shape, f?.shape ?? null, fieldPath, rows);
    }
  };

  const isObjectResponse = (shape) =>
    shape?.kind === 'object' || (shape?.kind === 'array' && isObjectResponse(shape.elem));

  const usageByType = new Map();
  for (const unit of units.values()) {
    if (unit.kind !== 'response' || !isObjectResponse(unit.back?.shape)) {
      continue;
    }
    const key = unit.front.typeName.replace(/\[\]$/, '');
    if (usageByType.has(key)) {
      usageByType.get(key).endpoints.push(...unit.endpoints);
      continue;
    }
    const rows = [];
    usageRows(unit.back.shape, unit.front.shape, '', rows);
    usageByType.set(key, { rows, endpoints: [...unit.endpoints] });
  }

  return { units, usageByType };
};
