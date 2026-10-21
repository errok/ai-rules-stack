#!/usr/bin/env node
/**
 * Convert Claude .md rules → Cursor .mdc rules (frontmatter + body).
 *
 * Usage:
 *   node scripts/claude-md-to-cursor-mdc.mjs [stack|all]
 *   stack: react-native | golang | all (default: all)
 *
 * Skips rule-manager-agent.md and STACK.md (tool-specific / Claude bootstrap).
 * Always-on set comes from STACK.md @-imports, plus any rule without paths:.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ARG = process.argv[2] ?? 'all';
const STACKS = ARG === 'all' ? ['react-native', 'golang'] : [ARG];
const SKIP = new Set(['rule-manager-agent.md', 'STACK.md']);

/** Basenames that must stay `.md` (reports, docs, skills — not Cursor rules). */
const KEEP_MD = new Set([
  'README',
  'LOGGING',
  'api-map',
  'dto-check',
  'report',
  'STACK',
  'CLAUDE',
  'SKILL',
]);

function parseFrontmatter(raw) {
  if (!raw.startsWith('---\n')) {
    return { meta: {}, body: raw, paths: [] };
  }
  const end = raw.indexOf('\n---\n', 4);
  if (end === -1) {
    return { meta: {}, body: raw, paths: [] };
  }
  const yaml = raw.slice(4, end);
  const body = raw.slice(end + 5);
  const meta = {};
  const paths = [];
  let key = null;
  let inPaths = false;

  for (const line of yaml.split('\n')) {
    const pathItem = line.match(/^\s+-\s+["']?([^"']+)["']?\s*$/);
    if (inPaths && pathItem) {
      paths.push(pathItem[1].trim());
      continue;
    }
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (m) {
      key = m[1];
      inPaths = key === 'paths';
      meta[key] = m[2];
      if (inPaths && m[2].trim() === '') {
        continue;
      }
      if (inPaths && m[2].trim()) {
        // Inline list rare; ignore
      }
      continue;
    }
    if (key && !inPaths && /^\s+/.test(line) && line.trim()) {
      meta[key] = `${meta[key] ?? ''}\n${line}`.trim();
    }
  }

  return { meta, body, paths };
}

function parseStackAlwaysOn(stackMdPath) {
  const set = new Set();
  if (!fs.existsSync(stackMdPath)) {
    return set;
  }
  const text = fs.readFileSync(stackMdPath, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^@\.claude\/rules\/stack\/(.+\.md)\s*$/);
    if (m) {
      set.add(m[1]);
    }
  }
  return set;
}

function rewriteBody(body, ruleBasenames) {
  let out = body.replaceAll('.claude/', '.cursor/');
  out = out.replace(/\b([\w./-]+)\.md\b/g, (full, stem) => {
    const base = path.basename(stem);
    if (KEEP_MD.has(base)) {
      return full;
    }
    if (ruleBasenames.has(base) || /-(auto|always|agent)$/.test(base)) {
      return `${stem}.mdc`;
    }
    return full;
  });
  return out;
}

function buildFrontmatter({ description, globs, alwaysApply }) {
  const lines = ['---'];
  if (description !== undefined && description !== '') {
    const d = String(description).trim();
    if (/[:#{}[\],&*?|>!%@`]/.test(d) || d.includes('\n') || d.includes('"')) {
      lines.push(`description: "${d.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
    } else {
      lines.push(`description: ${d}`);
    }
  }
  if (alwaysApply) {
    lines.push('globs:');
    lines.push('alwaysApply: true');
  } else {
    lines.push(`globs: ${globs.join(',')}`);
    lines.push('alwaysApply: false');
  }
  lines.push('---');
  return `${lines.join('\n')}\n\n`;
}

function walkMd(dir, acc = []) {
  if (!fs.existsSync(dir)) {
    return acc;
  }
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walkMd(full, acc);
    } else if (ent.name.endsWith('.md')) {
      acc.push(full);
    }
  }
  return acc;
}

function convertStack(stack) {
  const srcRoot = path.join(ROOT, 'claude', stack, 'claude', 'rules', 'stack');
  const destRoot = path.join(ROOT, 'cursor', stack, 'cursor', 'rules', 'stack');
  if (!fs.existsSync(srcRoot)) {
    process.stderr.write(`Source not found: ${srcRoot}\n`);
    process.exit(1);
  }

  const alwaysOnRels = parseStackAlwaysOn(path.join(srcRoot, 'STACK.md'));
  const files = walkMd(srcRoot);
  const ruleBasenames = new Set(
    files.filter((f) => !SKIP.has(path.basename(f))).map((f) => path.basename(f, '.md')),
  );

  let n = 0;
  let skipped = 0;

  process.stdout.write(`\n=== ${stack} ===\n`);

  for (const src of files) {
    const rel = path.relative(srcRoot, src);
    const base = path.basename(src);
    if (SKIP.has(base)) {
      process.stdout.write(`skip  ${rel}\n`);
      skipped++;
      continue;
    }

    const raw = fs.readFileSync(src, 'utf8');
    const { meta, body, paths } = parseFrontmatter(raw);
    const description = (meta.description ?? '')
      .trim()
      .replaceAll('.claude/', '.cursor/')
      .replaceAll('Claude rule', 'Cursor rule')
      .replaceAll('Claude Code', 'Cursor');
    const fromStack = alwaysOnRels.has(rel);
    const alwaysApply = fromStack || paths.length === 0;
    const globs = alwaysApply
      ? []
      : paths.map((p) => p.replaceAll('.claude/', '.cursor/'));
    const rewritten = rewriteBody(body.replace(/^\n+/, ''), ruleBasenames);
    const out =
      buildFrontmatter({ description, globs, alwaysApply }) +
      (rewritten.startsWith('\n') ? rewritten.slice(1) : rewritten);

    const dest = path.join(destRoot, rel.replace(/\.md$/, '.mdc'));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, out.endsWith('\n') ? out : `${out}\n`);
    process.stdout.write(
      `+     ${rel.replace(/\.md$/, '.mdc')}${alwaysApply ? ' [always]' : ` [${globs.join(',')}]`}\n`,
    );
    n++;
  }

  process.stdout.write(`Done ${stack}: ${n} written, ${skipped} skipped → ${destRoot}\n`);
  return { n, skipped };
}

let total = 0;
let totalSkip = 0;
for (const stack of STACKS) {
  if (!['react-native', 'golang'].includes(stack)) {
    process.stderr.write(`Unknown stack: ${stack}\n`);
    process.exit(1);
  }
  const { n, skipped } = convertStack(stack);
  total += n;
  totalSkip += skipped;
}
process.stdout.write(`\nTotal: ${total} written, ${totalSkip} skipped\n`);
