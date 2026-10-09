import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import { recipeSchema, validateLinks } from '../src/schema.js';
import { compile, build } from '../src/project.js';
import { assertOrigin } from '../src/capture.js';
import { inspectSource, startSource, staticServer } from '../src/source.js';
import { savePlan, selectGuides } from '../src/plan.js';

test('canvas settling is opt-in and bounded', () => {
  const recipe = { version: 1, title: 'Canvas', startUrl: 'https://example.com', allowedOrigins: ['https://example.com'],
    steps: [{ key: 'map', title: 'Map' }] };
  assert.equal(recipeSchema.parse(recipe).steps[0].settleMs, 0);
  assert.equal(recipeSchema.parse({ ...recipe, steps: [{ ...recipe.steps[0], settleMs: 3500 }] }).steps[0].settleMs, 3500);
  for (const settleMs of [-1, 10001, 1.5]) {
    assert.throws(() => recipeSchema.parse({ ...recipe, steps: [{ ...recipe.steps[0], settleMs }] }));
  }
});

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'visoready-agent-'));
  const png = new PNG({ width: 320, height: 240 }); png.data.fill(255);
  await writeFile(join(dir, 'screen.png'), PNG.sync.write(png));
  const manifest = { version: 1, title: 'Test', language: 'tr', steps: [{ key: 'one', title: 'One', image: 'screen.png',
    annotations: [{ px: [32, 24, 64, 48], text: '<script>not markup</script>', trigger: 'click' }] }] };
  const file = join(dir, 'manifest.json');
  const save = async () => writeFile(file, JSON.stringify(manifest));
  await save();
  return { dir, file, manifest, save };
}
test('real PNG dimensions and normalized coordinates, no invented screen explanation', async () => {
  const f = await fixture(); const result = await compile(f.file);
  assert.equal(result.project.steps[0].image.width, 320);
  assert.equal(result.project.steps[0].hotspots[0].x, .1);
  assert.equal(result.project.steps[0].hotspots[0].h, .2);
  assert.equal(result.project.steps[0].body, '');
  assert.equal(result.warnings.length, 1);
});
test('reject invalid bounds and broken goto, duplicate keys', async () => {
  const f = await fixture(); f.manifest.steps[0].annotations[0].px = [319, 0, 20, 20]; await f.save();
  await assert.rejects(compile(f.file), /outside image/);
  assert.throws(() => validateLinks([{ key: 'one', annotations: [{ trigger: 'goto', goto: 'missing' }] }]), /existing step/);
  assert.throws(() => validateLinks([{ key: 'one', annotations: [] }, { key: 'one', annotations: [] }]), /unique/);
});
test('reject traversal, corrupt image, unsupported format and forged hashes', async () => {
  const f = await fixture(); f.manifest.steps[0].image = '../screen.png'; await f.save();
  await assert.rejects(compile(f.file));
  f.manifest.steps[0].image = 'screen.png'; await f.save();
  await writeFile(join(f.dir, 'screen.png'), 'not an image');
  await assert.rejects(compile(f.file), /PNG/);
  const other = await fixture();
  await writeFile(other.file, JSON.stringify({ ...other.manifest, steps: [{ ...other.manifest.steps[0], evidence: { kind: 'browser', sha256: 'a'.repeat(64), capturedAt: new Date().toISOString() } }] }));
  await assert.rejects(compile(other.file), /hash mismatch/);
});
test('review escapes annotation HTML and never overwrites output', async () => {
  const f = await fixture(); const out = join(f.dir, 'out');
  await build(f.file, out);
  const review = await readFile(join(out, 'review.html'), 'utf8');
  assert(review.includes('&lt;script&gt;'));
  assert(!review.includes('<script>not markup'));
  await assert.rejects(build(f.file, out), /EEXIST/);
});
test('origins are exact; recipe rejects arbitrary code and unknown fields', () => {
  assertOrigin('http://localhost:3000/path', ['http://localhost:3000']);
  assert.throws(() => assertOrigin('http://localhost:3001', ['http://localhost:3000']));
  assert.throws(() => assertOrigin('http://u:p@localhost:3000', ['http://localhost:3000']));
  assert.throws(() => recipeSchema.parse({ version: 1, title: 'Test', startUrl: 'https://example.com', allowedOrigins: ['https://example.com'], steps: [{ key: 'one', title: 'One', actions: [{ type: 'eval', code: 'alert(1)' }] }] }));
});
test('source inspection does not execute scripts or read .env', async () => {
  const f = await fixture();
  await writeFile(join(f.dir, 'package.json'), JSON.stringify({ scripts: { dev: 'not executed' }, dependencies: { vite: '*' } }));
  await writeFile(join(f.dir, '.env'), 'SECRET=must-not-read');
  await writeFile(join(f.dir, '.env.example'), 'API_URL=https://example.com');
  const result = await inspectSource(f.dir);
  assert.equal(result.framework, 'vite'); assert(!result.files.includes('.env')); assert.deepEqual(result.environmentNames, ['API_URL']);
});
test('plan waits for selection, validates evidence, selects only requested guide', async () => {
  const f = await fixture(); await writeFile(join(f.dir, 'README.md'), 'Feature\nAnother feature');
  const guide = { id: 'one', title: 'Feature', goal: 'Learn', captureMode: 'native', prerequisites: [], outline: ['Open'], evidence: [{ file: 'README.md', line: 1 }] };
  const catalog = join(f.dir, 'catalog.json');
  await writeFile(catalog, JSON.stringify({ version: 1, project: 'Test', sourceDirectory: f.dir, guides: [guide, { ...guide, id: 'two' }] }));
  const plan = await savePlan(catalog, join(f.dir, 'plan'));
  assert((await readFile(join(plan, 'GUIDES.md'), 'utf8')).includes('awaiting user selection'));
  const selected = await selectGuides(join(plan, 'plan.json'), ['two'], join(f.dir, 'selected'));
  assert.equal(JSON.parse(await readFile(join(selected, 'selection.json'), 'utf8')).guides.length, 1);
  await assert.rejects(selectGuides(join(plan, 'plan.json'), ['missing'], join(f.dir, 'bad')), /existing/);
});
test('native source cannot be started as a web mock; occupied ports are preserved', async () => {
  const f = await fixture();
  await writeFile(join(f.dir, 'App.cs'), 'class App {}');
  await assert.rejects(startSource(f.dir, 4173, 'dev', true), /Unsupported startup/);
  const server = await staticServer(f.dir);
  try {
    const port = Number(new URL(server.url).port);
    await assert.rejects(staticServer(f.dir, port), /EADDRINUSE/);
    assert.equal((await fetch(server.url + '/screen.png')).status, 200);
    assert.equal((await fetch(server.url + '/.env')).status, 404);
  } finally { await server.close(); }
});
test('source-preview fidelity warning survives into the editable project', async () => {
  const f = await fixture();
  const { hash } = await import('../src/files.js');
  await writeFile(f.file, JSON.stringify({ ...f.manifest, steps: [{ ...f.manifest.steps[0], evidence: {
    kind: 'browser', fidelity: 'source-preview', sha256: hash(await readFile(join(f.dir, 'screen.png'))), capturedAt: new Date().toISOString()
  } }] }));
  const result = await compile(f.file);
  assert(result.project.meta.introDescription.includes('önizlemesi'));
  assert(result.warnings.some(w => w.includes('host/backend')));
});
test('native JPEG preserves original pixels, evidence, camera and frame style', async () => {
  const f = await fixture();
  const image = jpeg.encode({ width: 320, height: 240, data: Buffer.alloc(320 * 240 * 4, 255) }, 80).data;
  await writeFile(join(f.dir, 'screen.jpg'), image);
  const { hash } = await import('../src/files.js');
  const source = { ...f.manifest, steps: [{ ...f.manifest.steps[0], image: 'screen.jpg', annotations: [{
    ...f.manifest.steps[0].annotations[0], style: 'frame', spot: 'square', backdrop: false, showLabel: false, cameraPx: [0, 0, 160, 120]
  }], evidence: { kind: 'native', application: 'PowerPoint', coordinateSource: 'visual', sha256: hash(image), capturedAt: new Date().toISOString() } }] };
  await writeFile(f.file, JSON.stringify(source));
  const result = await compile(f.file), step = result.project.steps[0];
  assert.equal(step.image.type, 'image/jpeg');
  assert.equal(step.image.dataUrl, 'data:image/jpeg;base64,' + image.toString('base64'));
  assert.equal(step.hotspots[0].camera.w, .5);
  assert.equal(step.hotspots[0].style, 'frame');
  assert.equal(step.hotspots[0].spot, 'square');
  assert.equal(step.hotspots[0].backdrop, false);
  assert.equal(step.hotspots[0].showLabel, false);
  source.steps[0].annotations[0].cameraPx = [300, 0, 160, 120];
  await writeFile(f.file, JSON.stringify(source));
  await assert.rejects(compile(f.file), /Camera outside/);
});
