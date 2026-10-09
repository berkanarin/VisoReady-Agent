import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { packageRoot } from './install.js';
import { readJson } from './files.js';
import { staticServer } from './source.js';
import { capture } from './capture.js';
import { build } from './project.js';
import { checkEditor } from './editor.js';
import { resolveEditor } from './runtime.js';

const out = join(packageRoot, 'output', `demo-${Date.now()}`);
await mkdir(out, { recursive: true });
const server = await staticServer(join(packageRoot, 'examples', 'demo-app'));
try {
  const raw = await readJson(join(packageRoot, 'examples', 'demo.recipe.json'));
  const recipe = JSON.parse(JSON.stringify(raw).replaceAll('{{BASE_URL}}', server.url));
  const manifest = await capture(recipe, join(out, 'capture'), { allowActions: true });
  const result = await build(manifest, join(out, 'flow'));
  await checkEditor(join(result.out, 'project.ohig.json'), await resolveEditor(), join(out, 'check'));
  const report = await readJson(join(out, 'check', 'check.json')) as { passed: boolean };
  if (!report.passed) throw new Error('Demo quality checks failed; inspect check/QUALITY.md');
  console.log(`Demo complete: ${out}`);
} finally { await server.close(); }
