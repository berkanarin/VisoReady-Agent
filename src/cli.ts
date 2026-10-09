#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { resolve, join } from 'node:path';
import { access } from 'node:fs/promises';
import { chromium } from 'playwright';
import { z } from 'zod';
import { capture } from './capture.js';
import { build, compile } from './project.js';
import { checkEditor } from './editor.js';
import { installSkill, packageRoot } from './install.js';
import { inspectSource, cloneSource, startSource } from './source.js';
import { savePlan, selectGuides } from './plan.js';
import { readJson } from './files.js';
import { resolveEditor } from './runtime.js';

const help = `VisoReady Agent 0.1

  doctor
  inspect <local-project>
  clone <https-repository-url> --out <new-directory>
  plan <catalog.json> --out <new-directory>
  select <plan.json> --ids <id,id> --out <new-directory>
  capture <recipe.json> --out <new-directory> [--allow-actions] [--headed] [--auth <storage.json>]
  run-source <local-project> --recipe <recipe.json> --out <new-directory> [--port 4173] [--script dev] [--allow-run] [--allow-actions]
  validate <manifest.json>
  build <manifest.json> --out <new-directory>
  check <project.ohig.json> --out <new-directory> [--editor <VisoReady.html>]
  install-skill [--client codex|claude|both] [--install-root <isolated-test-directory>]

Use pnpm agent <command>. See README.md. No AI API key is required by this CLI;
Codex/Claude supplies planning and narration. Output directories must be new.
Repository inspection does not install or run anything. Plan first, wait for selection.
`;
async function main() {
  const { values: flags, positionals } = parseArgs({ allowPositionals: true, options: {
    out: { type: 'string' }, editor: { type: 'string' }, auth: { type: 'string' }, client: { type: 'string', default: 'both' },
    recipe: { type: 'string' }, ids: { type: 'string' }, port: { type: 'string', default: '4173' }, script: { type: 'string', default: 'dev' },
    'allow-actions': { type: 'boolean', default: false }, 'allow-run': { type: 'boolean', default: false },
    headed: { type: 'boolean', default: false }, help: { type: 'boolean', default: false }, 'install-root': { type: 'string' }
  } });
  const [command, input] = positionals;
  const required = (value: string | undefined, label: string) => { if (!value) throw new Error(`Missing ${label}`); return value; };
  const output = () => resolve(required(flags.out, '--out'));
  const file = () => resolve(required(input, 'input path'));
  const captureOptions = { allowActions: flags['allow-actions'], headed: flags.headed, storageState: flags.auth ? resolve(flags.auth) : undefined };
  if (flags.help || !command) { console.log(help); return; }
  let result: unknown;
  switch (command) {
    case 'doctor': {
      const executable = chromium.executablePath();
      await access(executable).catch(() => { throw new Error('Chromium missing: run pnpm exec playwright install chromium'); });
      const browser = await chromium.launch(); await browser.close();
      result = { node: process.version, browser: 'Chromium launch OK', packageRoot, editor: await resolveEditor() }; break;
    }
    case 'inspect': result = await inspectSource(file()); break;
    case 'clone': result = await cloneSource(required(input, 'repository URL'), output()); break;
    case 'plan': result = await savePlan(file(), output()); break;
    case 'select': result = await selectGuides(file(), required(flags.ids, '--ids').split(',').map(s => s.trim()), output()); break;
    case 'capture': result = await capture(await readJson(file()), output(), captureOptions); break;
    case 'validate': { const data = await compile(file()); result = { valid: true, steps: data.project.steps.length, warnings: data.warnings }; break; }
    case 'build': result = await build(file(), output()); break;
    case 'check': {
      const out = await checkEditor(file(), flags.editor ?? await resolveEditor(), output());
      const report = await readJson(join(out, 'check.json')) as { passed: boolean; qualityStatus: string; checkedStates: number };
      result = { out, ...report };
      if (!report.passed) process.exitCode = 1;
      break;
    }
    case 'install-skill': result = await installSkill(flags.client, flags['install-root']); break;
    case 'run-source': {
      const recipe = await readJson(resolve(required(flags.recipe, '--recipe')));
      const server = await startSource(file(), Number(flags.port), flags.script, flags['allow-run']);
      const stop = () => { void server.close().finally(() => process.exit(130)); };
      process.once('SIGINT', stop); process.once('SIGTERM', stop);
      try {
        // Only substitute the documented local-server token; do not rewrite arbitrary remote origins.
        const localRecipe = JSON.parse(JSON.stringify(recipe).replaceAll('{{BASE_URL}}', server.url));
        result = await capture(localRecipe, output(), captureOptions);
      } finally { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); await server.close(); }
      break;
    }
    default: throw new Error(`Unknown command: ${command}\n${help}`);
  }
  console.log(JSON.stringify(result, null, 2));
}
main().catch(error => {
  if (error instanceof z.ZodError) console.error(error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('\n'));
  else console.error(error instanceof Error ? error.message : 'Operation failed');
  process.exitCode = 1;
});
