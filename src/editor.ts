import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { newDirectory, writeJson } from './files.js';
import type { Project } from './project.js';
import { auditPlayer } from './quality.js';

type EditorWindow = Window & {
  GuideMakerModel: { normaliseProjectShape: (p: Project) => Project };
  GuideMakerExporters: { buildSingleFileHtml: (p: Project) => string };
};
export async function checkEditor(projectFile: string, editorFile: string, destination: string) {
  const project: Project = JSON.parse(await readFile(projectFile, 'utf8'));
  if (!project.steps?.length || !project.meta) throw new Error('Not a VisoReady project');
  const out = await newDirectory(destination);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route(/^https?:/, route => route.abort());
    await page.goto(pathToFileURL(resolve(editorFile)).href);
    await page.waitForFunction(() => Boolean((window as unknown as EditorWindow).GuideMakerExporters));
    const result = await page.evaluate(p => {
      const api = window as unknown as EditorWindow;
      const normal = api.GuideMakerModel.normaliseProjectShape(p);
      return { normal, html: api.GuideMakerExporters.buildSingleFileHtml(normal) };
    }, project);
    if (result.normal.steps.length !== project.steps.length) throw new Error('Editor changed step count');
    for (let i = 0; i < project.steps.length; i++) {
      const original = project.steps[i], normalized = result.normal.steps[i];
      if (normalized.hotspots.length !== original.hotspots.length || normalized.image.dataUrl !== original.image.dataUrl) throw new Error('Editor changed project content');
      original.hotspots.forEach((a, j) => {
        const b = normalized.hotspots[j];
        if (a.label !== b.label || a.showLabel !== b.showLabel || a.description !== b.description || a.trigger !== b.trigger || a.gotoStepId !== b.gotoStepId ||
          (['x', 'y', 'w', 'h'] as const).some(k => Math.abs(a[k] - b[k]) > .001)) throw new Error('Annotation did not survive normalization');
      });
    }
    await page.locator('#project-input').setInputFiles({ name: 'project.ohig.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
    await page.waitForFunction(count => document.querySelectorAll('.v8-timeline-clip').length === count, project.steps.length);
    await page.locator('#stage-image').waitFor({ state: 'visible' });
    await settleAnimations(page);
    await page.screenshot({ path: join(out, 'editor.png') });
    const playerFile = join(out, 'preview.html');
    await writeFile(playerFile, result.html, { flag: 'wx' });
    for (const width of [1440, 390]) {
      const player = await browser.newPage({ viewport: { width, height: 900 } });
      player.on('pageerror', e => errors.push(e.message));
      await player.route(/^https?:/, route => route.abort());
      await player.goto(pathToFileURL(playerFile).href);
      const start = player.locator('#intro-start-btn');
      if (await start.isVisible()) await start.click();
      await player.waitForFunction(() => {
        const img = document.querySelector<HTMLImageElement>('#stage-image');
        return img && img.complete && img.naturalWidth > 0;
      });
      await settleAnimations(player);
      await player.screenshot({ path: join(out, `player-${width}.png`) });
      await player.close();
    }
    if (errors.length) throw new Error(`Editor/player errors: ${errors.join('; ')}`);
    const quality = await auditPlayer(browser, project, out);
    await writeJson(join(out, 'check.json'), { passed: quality.errors === 0 && quality.checkedStates === quality.expectedStates, steps: project.steps.length,
      checks: ['editor normalization', 'actual project import', 'offline HTML export', 'desktop/mobile player first screen'],
      qualityStatus: quality.status, checkedStates: quality.checkedStates,
      pending: ['human visual review', 'source application outcome verification', ...quality.limitations] });
    return out;
  } finally { await browser.close(); }
}

async function settleAnimations(page: import('playwright').Page) {
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity)
      .map(a => a.finished.catch(() => undefined)));
  });
}
