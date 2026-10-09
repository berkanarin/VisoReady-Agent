import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { compile } from '../src/project.js';
import { checkEditor } from '../src/editor.js';
import { resolveEditor } from '../src/runtime.js';
import { capture } from '../src/capture.js';
import { staticServer } from '../src/source.js';
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';

test('actual editor checks all states including a nonsequential goto without changing input', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'visoready-quality-'));
  const png = new PNG({ width: 640, height: 480 }); png.data.fill(230);
  await writeFile(join(dir, 'screen.png'), PNG.sync.write(png));
  const manifest = { version: 1, title: 'Quality', language: 'en', steps: ['one', 'two', 'three'].map((key, i) => ({ key, title: key, image: 'screen.png', annotations: [
    { label: 'Inspect this area', showLabel: true, text: 'Read this area', px: [50, 50, 120, 40], trigger: 'auto' },
    { text: 'Continue', px: [450, 300, 80, 40], trigger: i === 0 ? 'goto' : 'click', ...(i === 0 ? { goto: 'three' } : {}) }
  ] })) };
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest));
  const { project } = await compile(join(dir, 'manifest.json'));
  const input = JSON.stringify(project);
  const file = join(dir, 'project.json'); await writeFile(file, input);
  await checkEditor(file, await resolveEditor(), join(dir, 'check'));
  const result = JSON.parse(await readFile(join(dir, 'check', 'quality.json'), 'utf8'));
  assert.equal(result.checkedStates, 12);
  assert.equal(result.findings.filter((f: {code: string}) => f.code === 'interaction-failed').length, 0);
  assert.equal(await readFile(file, 'utf8'), input);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(join(dir, 'check', 'preview.html')).href);
    const start = page.locator('#intro-start-btn');
    if (await start.isVisible()) await start.click();
    const heading = page.locator('#tooltip h3');
    await heading.waitFor({ state: 'visible' });
    assert.equal(await heading.innerText(), 'Inspect this area');
  } finally { await browser.close(); }
});

test('capture verifies asynchronous result text and fails closed on a wrong result', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'visoready-result-'));
  await writeFile(join(dir, 'index.html'), '<div id="result">Loading</div><script>setTimeout(()=>document.querySelector("#result").textContent="Training saved",200)</script>');
  const server = await staticServer(dir);
  const recipe = { version: 1, title: 'Test', startUrl: server.url, allowedOrigins: [server.url], steps: [{ key: 'a', title: 'A', assertions: [{ target: '#result', containsText: 'Training saved' }] }] };
  try {
    const file = await capture(recipe, join(dir, 'pass'));
    const result = JSON.parse(await readFile(file, 'utf8'));
    assert.equal(result.steps[0].evidence.assertionsPassed, 1);
    recipe.steps[0].assertions[0].containsText = 'Wrong result';
    await assert.rejects(capture(recipe, join(dir, 'fail')), /Capture stopped/);
    await assert.rejects(readFile(join(dir, 'fail', 'manifest.json')));
  } finally { await server.close(); }
});
