#!/usr/bin/env node
/**
 * Auto-inject project rules based on the file being edited.
 *
 * Wired in .claude/settings.json:
 *   - PreToolUse  (matcher Edit|Write|MultiEdit)  -> no arg   : inject matching rules
 *   - PreCompact  (matcher *)                      -> --reset  : clear the session cache
 *
 * Mechanism: each .claude/rules/**\/*.md file carries a `globs:` line in its
 * frontmatter (unquoted, comma-separated). When a tool is about to write a file
 * whose repo-relative path matches one of those globs, the rule body is fed to
 * the model via hookSpecificOutput.additionalContext.
 *
 * A per-session cache (os.tmpdir()/claude-rules-<session_id>.json) records which
 * rules were already injected, so each rule is sent once per session. PreCompact
 * wipes that cache so rules are re-injected fresh after context compaction.
 *
 * Fails open: any error, unknown tool, or out-of-repo path -> no output, exit 0.
 * Never exits non-zero (that would block the tool call).
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const RESET = process.argv.includes('--reset');
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit']);

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function cachePathFor(sessionId) {
  const safe = String(sessionId || 'unknown').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 128);
  return path.join(os.tmpdir(), `claude-rules-${safe}.json`);
}

function pruneStaleCaches() {
  try {
    const dir = os.tmpdir();
    const cutoff = Date.now() - 48 * 3600 * 1000;
    for (const name of fs.readdirSync(dir)) {
      if (!name.startsWith('claude-rules-') || !name.endsWith('.json')) continue;
      const p = path.join(dir, name);
      try {
        if (fs.statSync(p).mtimeMs < cutoff) fs.unlinkSync(p);
      } catch {}
    }
  } catch {}
}

function globToRegExp(glob) {
  let g = glob.trim().replace(/^\.\//, '').replace(/\/+$/, '');
  let re = '';
  for (let i = 0; i < g.length; ) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') {
        const prevSlash = i === 0 || g[i - 1] === '/';
        const nextSlash = g[i + 2] === '/';
        if (prevSlash && nextSlash) {
          re += '(?:.*/)?';
          i += 3;
        } else {
          re += '.*';
          i += 2;
        }
        continue;
      }
      re += '[^/]*';
      i += 1;
      continue;
    }
    if (c === '?') {
      re += '[^/]';
      i += 1;
      continue;
    }
    if (c === '{') {
      const end = g.indexOf('}', i);
      if (end !== -1) {
        const parts = g
          .slice(i + 1, end)
          .split(',')
          .map((p) => p.replace(/[.+^${}()|[\]\\]/g, '\\$&'));
        re += '(?:' + parts.join('|') + ')';
        i = end + 1;
        continue;
      }
      re += '\\{';
      i += 1;
      continue;
    }
    if ('.+^$()|[]\\'.includes(c)) {
      re += '\\' + c;
      i += 1;
      continue;
    }
    re += c;
    i += 1;
  }
  return new RegExp('^' + re + '$');
}

function parseRuleFile(absPath) {
  const raw = fs.readFileSync(absPath, 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return null;
  const front = m[1];
  const body = raw.slice(m[0].length).trim();
  const gm = front.match(/^globs:\s*(.*)$/m);
  if (!gm) return null;
  const globs = gm[1]
    .trim()
    .replace(/^["']|["']$/g, '')
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
  if (globs.length === 0) return null;
  return { globs, body };
}

function walkMd(dir, out, seen) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  const visited = seen || new Set();
  for (const e of entries) {
    const p = path.join(dir, e.name);
    // Dirent flags come from lstat, so a symlink answers false to both. Projects
    // symlink the shared rules in as .claude/rules/stack, so resolve links here or
    // the whole generic layer goes silently unseen. `realpath` guards against loops.
    let isDir = e.isDirectory();
    let isFile = e.isFile();
    if (e.isSymbolicLink()) {
      try {
        const real = fs.realpathSync(p);
        if (visited.has(real)) continue;
        visited.add(real);
        const st = fs.statSync(p);
        isDir = st.isDirectory();
        isFile = st.isFile();
      } catch {
        continue;
      }
    }
    if (isDir) walkMd(p, out, visited);
    else if (isFile && e.name.endsWith('.md')) out.push(p);
  }
}

function main() {
  const input = readStdin();
  let payload = {};
  try {
    payload = JSON.parse(input || '{}');
  } catch {
    return;
  }

  const sessionId = payload.session_id || payload.sessionId;
  const cacheFile = cachePathFor(sessionId);

  if (RESET) {
    try {
      fs.unlinkSync(cacheFile);
    } catch {}
    return;
  }

  const toolName = payload.tool_name || payload.toolName;
  if (!EDIT_TOOLS.has(toolName)) return;

  const toolInput = payload.tool_input || payload.toolInput || {};
  const filePath = toolInput.file_path || toolInput.filePath || toolInput.path;
  if (!filePath) return;

  const root = process.env.CLAUDE_PROJECT_DIR || payload.cwd || process.cwd();
  const absFile = path.resolve(root, filePath);
  let rel = path.relative(root, absFile);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return;
  rel = rel.split(path.sep).join('/');

  const rulesDir = path.join(root, '.claude', 'rules');
  const files = [];
  walkMd(rulesDir, files);
  if (files.length === 0) return;

  const matched = [];
  for (const abs of files) {
    let parsed;
    try {
      parsed = parseRuleFile(abs);
    } catch {
      continue;
    }
    if (!parsed) continue;
    const hit = parsed.globs.find((g) => {
      try {
        return globToRegExp(g).test(rel);
      } catch {
        return false;
      }
    });
    if (!hit) continue;
    const ruleRel = path.relative(root, abs).split(path.sep).join('/');
    matched.push({ ruleRel, matchedGlob: hit, globs: parsed.globs, body: parsed.body });
  }
  if (matched.length === 0) return;

  let cache = [];
  try {
    cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    if (!Array.isArray(cache)) cache = [];
  } catch {}
  const already = new Set(cache);

  const fresh = matched.filter((r) => !already.has(r.ruleRel));
  if (fresh.length === 0) return;

  const blocks = fresh
    .map(
      (r) =>
        `<rule path="${r.ruleRel}" globs="${r.globs.join(',')}" matched="${r.matchedGlob}">\n${r.body}\n</rule>`,
    )
    .join('\n\n');

  const additionalContext =
    `Project rules for \`${rel}\` (auto-injected from .claude/rules/ by glob match; ` +
    `shown once per session, re-injected after context compaction). Follow them for this and related edits:\n\n` +
    blocks;

  try {
    fs.writeFileSync(cacheFile, JSON.stringify([...already, ...fresh.map((r) => r.ruleRel)]));
  } catch {}
  pruneStaleCaches();

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext,
      },
    }),
  );
}

try {
  main();
} catch {
  // fail open
}
process.exit(0);
