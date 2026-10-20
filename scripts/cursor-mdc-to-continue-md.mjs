#!/usr/bin/env node
/**
 * Convert Cursor .mdc rules → Continue .md rules (frontmatter + body).
 *
 * Usage:
 *   node scripts/cursor-mdc-to-continue-md.mjs [stack]
 *   stack defaults to react-native
 *
 * Skips rule-manager-agent.mdc (rewritten by hand for Continue paths).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const STACK = process.argv[2] ?? "react-native";
const SRC = path.join(ROOT, "cursor", STACK, "cursor", "rules", "stack");
const DEST = path.join(ROOT, "continue", STACK, "continue", "rules", "stack");
const SKIP = new Set(["rule-manager-agent.mdc"]);

function parseFrontmatter(raw) {
  if (!raw.startsWith("---\n")) {
    return { meta: {}, body: raw };
  }
  const end = raw.indexOf("\n---\n", 4);
  if (end === -1) {
    return { meta: {}, body: raw };
  }
  const yaml = raw.slice(4, end);
  const body = raw.slice(end + 5);
  const meta = {};
  let key = null;
  for (const line of yaml.split("\n")) {
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (m) {
      key = m[1];
      meta[key] = m[2];
      continue;
    }
    if (key && /^\s+/.test(line) && line.trim()) {
      meta[key] = `${meta[key] ?? ""}\n${line}`.trim();
    }
  }
  return { meta, body };
}

function parseGlobs(raw) {
  if (raw === undefined || raw === null) return undefined;
  const s = String(raw).trim();
  if (!s) return [];
  if (s.startsWith("[")) {
    try {
      return JSON.parse(s.replace(/'/g, '"'));
    } catch {
      /* fall through */
    }
  }
  return s
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean);
}

function titleFromBody(body, fallback) {
  const m = body.match(/^#\s+(.+)$/m);
  if (m) return m[1].trim();
  return fallback
    .replace(/-(always|auto|agent)$/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatYamlValue(v) {
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    return `\n${v.map((g) => `  - "${g.replace(/"/g, '\\"')}"`).join("\n")}`;
  }
  const s = String(v);
  if (/[:#{}[\],&*?|>!%@`]/.test(s) || s.includes("\n") || s.includes('"')) {
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return s;
}

function buildFrontmatter({ name, description, globs, alwaysApply }) {
  const lines = ["---", `name: ${formatYamlValue(name)}`];
  if (description !== undefined && description !== "") {
    lines.push(`description: ${formatYamlValue(description)}`);
  }
  if (alwaysApply !== undefined) {
    lines.push(`alwaysApply: ${alwaysApply ? "true" : "false"}`);
  }
  if (globs !== undefined) {
    if (globs.length === 0) {
      // Keep empty globs explicit only when alwaysApply is true (Cursor style).
      if (alwaysApply === true) {
        lines.push("globs: []");
      }
    } else if (globs.length === 1) {
      lines.push(`globs: ${formatYamlValue(globs[0])}`);
    } else {
      lines.push(`globs:${formatYamlValue(globs)}`);
    }
  }
  lines.push("---", "");
  return lines.join("\n");
}

function convertFile(srcPath, destPath) {
  const raw = fs.readFileSync(srcPath, "utf8");
  const { meta, body } = parseFrontmatter(raw);
  const base = path.basename(srcPath, ".mdc");
  const alwaysApply =
    meta.alwaysApply === "true"
      ? true
      : meta.alwaysApply === "false"
        ? false
        : undefined;
  const globs =
    "globs" in meta ? parseGlobs(meta.globs) : undefined;
  const name = titleFromBody(body, base);
  const description = meta.description?.trim() ?? "";

  const out =
    buildFrontmatter({ name, description, globs, alwaysApply }) +
    body.replace(/^\n+/, "");

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, out.endsWith("\n") ? out : `${out}\n`);
}

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, acc);
    else if (ent.name.endsWith(".mdc")) acc.push(full);
  }
  return acc;
}

if (!fs.existsSync(SRC)) {
  console.error(`Source not found: ${SRC}`);
  process.exit(1);
}

let n = 0;
let skipped = 0;
for (const src of walk(SRC)) {
  const rel = path.relative(SRC, src);
  if (SKIP.has(path.basename(src))) {
    console.log(`skip  ${rel}`);
    skipped++;
    continue;
  }
  const dest = path.join(DEST, rel.replace(/\.mdc$/, ".md"));
  convertFile(src, dest);
  console.log(`+     ${rel.replace(/\.mdc$/, ".md")}`);
  n++;
}

console.log(`Done: ${n} written, ${skipped} skipped → ${DEST}`);
