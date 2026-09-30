/** Compiler and linter, run as part of the audit so the report holds everything to fix before a release. */
import { execSync } from 'node:child_process';

const RULE = 'stack/ts-rules/typescript-conventions-auto.md';

/** Output of a command, whether it passes or fails. */
const run = (cmd, cwd) => {
  try {
    return { ok: true, output: execSync(cmd, { cwd, encoding: 'utf8', stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 }) };
  } catch (error) {
    return { ok: false, output: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
};

export const toolingChecks = [
  {
    id: 'F-TOOL-01',
    rule: RULE,
    sev: 'error',
    run: (p) => {
      const { ok, output } = run('npx tsc --noEmit', p.root);
      if (ok) {
        return [];
      }
      const out = [];
      for (const line of output.split('\n')) {
        const m = line.match(/^(.+?)\((\d+),\d+\): error (TS\d+): (.*)$/);
        if (m) {
          out.push({ file: m[1], line: Number(m[2]), msg: `${m[3]}: ${m[4]}` });
        }
      }
      return out.length ? out : [{ file: '', line: 0, msg: output.trim().slice(0, 500) }];
    },
  },
  {
    id: 'F-TOOL-02',
    rule: RULE,
    sev: 'error',
    run: (p) => {
      const { ok, output } = run('npx biome ci --reporter=github --colors=off .', p.root);
      if (ok) {
        return [];
      }
      const out = [];
      for (const line of output.split('\n')) {
        const m = line.match(/^::(error|warning)\s+(?:title=([^,]*),)?file=([^,]+),line=(\d+)[^:]*::(.*)$/);
        // Design prototypes (docs/, modules/*/docs) and the stack submodule are not app code.
        if (m && !/(^|\/)docs\//.test(m[3]) && !m[3].startsWith('sub-modules/')) {
          out.push({
            file: m[3],
            line: Number(m[4]),
            msg: `${m[1] === 'error' ? 'erreur' : 'avertissement'} \`${m[2] ?? 'biome'}\` : ${m[5]}`,
          });
        }
      }
      return out.length || /::(error|warning)/.test(output)
        ? out
        : [{ file: '', line: 0, msg: output.trim().slice(0, 500) }];
    },
  },
];
