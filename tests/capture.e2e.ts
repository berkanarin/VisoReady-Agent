import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packageRoot } from '../src/install.js';
import { staticServer, inspectSource } from '../src/source.js';
import { capture } from '../src/capture.js';
import { readJson } from '../src/files.js';
import { compile } from '../src/project.js';
import { recipeSchema } from '../src/schema.js';
import { PNG } from 'pngjs';

test('capture actual UI states and exact boxes; reject missing permission and failed targets', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'visoready-e2e-'));
  const server = await staticServer(join(packageRoot, 'examples', 'demo-app'));
  try {
    const raw = await readJson(join(packageRoot, 'examples', 'demo.recipe.json'));
    const recipe = recipeSchema.parse(JSON.parse(JSON.stringify(raw).replaceAll('{{BASE_URL}}', server.url)));
    await assert.rejects(capture(recipe, join(dir, 'denied')), /allow-actions/);
    const file = await capture(recipe, join(dir, 'ok'), { allowActions: true });
    const result = await compile(file);
    assert.equal(result.project.steps.length, 3);
    assert.equal(result.project.steps[1].hotspots.length, 3);
    assert.equal(result.project.steps[0].hotspots[0].gotoStepId, 'step-form');
    assert.notEqual(result.project.steps[0].image.dataUrl, result.project.steps[1].image.dataUrl);
    const png = PNG.sync.read(await readFile(join(dir, 'ok', '01-list.png')));
    const colors = new Set(); for (let i = 0; i < png.data.length; i += 400) colors.add(png.data.subarray(i, i + 3).toString('hex'));
    assert(colors.size > 8, 'Screenshot must contain rendered UI');
    const broken = { ...recipe, steps: [{ ...recipe.steps[0], annotations: [{ ...recipe.steps[0].annotations[0], target: '#missing' }] }] };
    broken.steps[0].annotations[0].trigger = 'click'; delete broken.steps[0].annotations[0].goto;
    await assert.rejects(capture(broken, join(dir, 'failed')), /Capture stopped/);
    assert.equal(JSON.parse(await readFile(join(dir, 'failed', 'failure.json'), 'utf8')).status, 'failed');
  } finally { await server.close(); }
});
test('opaque masks are burned into screenshot pixels and native source is not served as web', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'visoready-mask-'));
  await writeFile(join(dir, 'index.html'), '<label>Secret<input type="password" value="private"></label><div id="pii" style="width:200px;height:100px;background:red">Sensitive</div>');
  await writeFile(join(dir, 'Native.cs'), 'using System.Windows.Forms;');
  assert.equal((await inspectSource(dir)).framework, 'native');
  const server = await staticServer(dir);
  try {
    await capture({ version: 1, title: 'Mask', startUrl: server.url, allowedOrigins: [server.url], masks: ['#pii'],
      viewport: { width: 640, height: 480 }, steps: [{ key: 'mask', title: 'Mask', annotations: [] }] }, join(dir, 'capture'));
    const png = PNG.sync.read(await readFile(join(dir, 'capture', '01-mask.png')));
    const pixel = (30 * png.width + 20) * 4;
    assert.deepEqual([...png.data.subarray(pixel, pixel + 3)], [24, 24, 27]);
  } finally { await server.close(); }
});
