import { chromium, type Page, type Locator } from 'playwright';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { recipeSchema, validateLinks, type Target, type Manifest } from './schema.js';
import { hash, newDirectory, writeJson } from './files.js';

export function locate(page: Page, target: Target): Locator {
  if (typeof target === 'string') return page.locator(target);
  if ('role' in target) return page.getByRole(target.role, { name: target.name, exact: true });
  if ('label' in target) return page.getByLabel(target.label, { exact: true });
  return page.getByTestId(target.testId);
}
export function assertOrigin(url: string, allowed: string[]) {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || !allowed.includes(parsed.origin)) {
    throw new Error('Navigation is outside allowedOrigins');
  }
}
function safeUrl(value: string) {
  const url = new URL(value);
  url.search = ''; url.hash = ''; url.username = ''; url.password = '';
  return url.href;
}
async function boxFor(locator: Locator, width: number, height: number): Promise<[number, number, number, number]> {
  await locator.waitFor({ state: 'visible' });
  const b = await locator.boundingBox();
  if (!b || b.width <= 0 || b.height <= 0 || b.x < 0 || b.y < 0 || b.x + b.width > width || b.y + b.height > height) {
    throw new Error('Annotation target is missing or outside the viewport; scroll explicitly or use another step');
  }
  return [b.x, b.y, b.width, b.height];
}
export type CaptureOptions = { allowActions?: boolean; headed?: boolean; storageState?: string };
export async function capture(input: unknown, destination: string, options: CaptureOptions = {}) {
  const recipe = recipeSchema.parse(input);
  validateLinks(recipe.steps);
  assertOrigin(recipe.startUrl, recipe.allowedOrigins);
  for (const step of recipe.steps) for (const action of step.actions) {
    if (action.type === 'goto') assertOrigin(action.url, recipe.allowedOrigins);
    if (!['goto', 'scroll', 'wait'].includes(action.type) && !options.allowActions) {
      throw new Error('This recipe performs actions. Review it, then explicitly use --allow-actions');
    }
    if (action.type === 'fillSecret' && !process.env[action.env]) throw new Error(`Missing environment variable: ${action.env}`);
  }
  const out = await newDirectory(destination);
  const manifest: Manifest = { version: 1, title: recipe.title, language: recipe.language, steps: [] };
  const browser = await chromium.launch({ headless: !options.headed });
  let currentStep = 'start';
  try {
    const context = await browser.newContext({
      viewport: recipe.viewport, deviceScaleFactor: 1, locale: recipe.language === 'tr' ? 'tr-TR' : 'en-US',
      reducedMotion: 'reduce', colorScheme: 'light', serviceWorkers: 'block', acceptDownloads: false,
      storageState: options.storageState
    });
    context.setDefaultTimeout(15000);
    context.setDefaultNavigationTimeout(30000);
    let blocked = false;
    await context.route('**/*', async route => {
      if (route.request().isNavigationRequest()) {
        try { assertOrigin(route.request().url(), recipe.allowedOrigins); }
        catch { blocked = true; await route.abort(); return; }
      }
      await route.continue();
    });
    const page = await context.newPage();
    let unexpected = false;
    page.on('dialog', async dialog => { unexpected = true; await dialog.dismiss(); });
    context.on('page', async other => { if (other !== page) { unexpected = true; await other.close(); } });
    await page.goto(recipe.startUrl, { waitUntil: 'domcontentloaded' });
    const secrets: Target[] = [];
    for (const step of recipe.steps) {
      currentStep = step.key;
      for (const action of step.actions) {
        if (blocked || unexpected) throw new Error('Blocked navigation, popup or dialog');
        assertOrigin(page.url(), recipe.allowedOrigins);
        if (action.type === 'goto') await page.goto(action.url, { waitUntil: 'domcontentloaded' });
        else {
          const target = locate(page, action.target);
          switch (action.type) {
            case 'click': await target.click(); break;
            case 'fill': await target.fill(action.value); break;
            case 'fillSecret': secrets.push(action.target); await target.fill(process.env[action.env]!); break;
            case 'press': await target.press(action.key); break;
            case 'select': await target.selectOption(action.value); break;
            case 'check': await target.setChecked(action.checked); break;
            case 'scroll': await target.scrollIntoViewIfNeeded(); break;
            case 'wait': await target.waitFor({ state: action.state }); break;
          }
        }
      }
      if (step.ready) await locate(page, step.ready).waitFor({ state: 'visible' });
      for (const assertion of step.assertions) {
        const target = locate(page, assertion.target);
        await target.waitFor({ state: 'visible' });
        // Retry asynchronous result rendering without replaying any mutation.
        const deadline = Date.now() + 15000;
        while (!(await target.innerText()).includes(assertion.containsText)) {
          if (Date.now() >= deadline) throw new Error('Expected result was not observed');
          await page.waitForTimeout(100);
        }
      }
      // Canvas maps can finish painting after their accessible controls appear.
      await page.mouse.move(0, 0);
      if (step.settleMs) await page.waitForTimeout(step.settleMs);
      // Pause visual motion before measuring; screenshot and boxes share CSS pixels.
      await page.addStyleTag({ content: '*,*::before,*::after{animation-play-state:paused!important;transition:none!important;caret-color:transparent!important}' });
      await page.waitForFunction(() => document.fonts.status === 'loaded' && Array.from(document.images).every(i => i.complete));
      const targets = step.annotations.map(a => locate(page, a.target));
      const boxes: [number, number, number, number][] = [];
      for (const target of targets) boxes.push(await boxFor(target, recipe.viewport.width, recipe.viewport.height));
      const scroll = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
      const url = page.url();
      const bytes = await page.screenshot({
        type: 'png', fullPage: false, scale: 'css', caret: 'hide',
        mask: [page.locator('input[type="password"]'), ...recipe.masks.map(t => locate(page, t)), ...secrets.map(t => locate(page, t))],
        maskColor: '#18181B'
      });
      for (let i = 0; i < targets.length; i++) {
        const after = await boxFor(targets[i], recipe.viewport.width, recipe.viewport.height);
        if (after.some((v, j) => Math.abs(v - boxes[i][j]) > 0.5)) throw new Error('Target moved during capture');
      }
      const afterScroll = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
      if (page.url() !== url || scroll.x !== afterScroll.x || scroll.y !== afterScroll.y || blocked || unexpected) {
        throw new Error('Page changed during capture or opened an unsupported dialog/popup');
      }
      assertOrigin(url, recipe.allowedOrigins);
      const image = `${String(manifest.steps.length + 1).padStart(2, '0')}-${step.key}.png`;
      await writeFile(join(out, image), bytes, { flag: 'wx' });
      manifest.steps.push({
        key: step.key, title: step.title, image,
        annotations: step.annotations.map((a, i) => ({ text: a.text, style: a.style, spot: a.spot, backdrop: a.backdrop, showLabel: a.showLabel, label: a.label, trigger: a.trigger, goto: a.goto, px: boxes[i] })),
        evidence: { kind: 'browser', fidelity: recipe.fidelity, sha256: hash(bytes), capturedAt: new Date().toISOString(), url: safeUrl(url), viewport: recipe.viewport, scroll, assertionsPassed: step.assertions.length }
      });
    }
    await writeJson(join(out, 'manifest.json'), manifest);
    return join(out, 'manifest.json');
  } catch {
    // Browser errors can include form values and tokens. Never persist those verbatim.
    await writeJson(join(out, 'failure.json'), { status: 'failed', step: currentStep, completed: manifest.steps.length,
      message: 'Capture stopped. Inspect the page, readiness target, origins and locators. No complete manifest was produced.' });
    throw new Error(`Capture stopped at ${currentStep}; see failure.json. Partial captures are not a complete flow.`);
  } finally { await browser.close(); }
}
