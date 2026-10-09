import type { Browser, Page } from 'playwright';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
import type { Project } from './project.js';
import { writeJson } from './files.js';

export type Rect = { x: number; y: number; width: number; height: number };
export function overlap(a: Rect, b: Rect) {
  const area = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return a.width * a.height > 0 ? area / (a.width * a.height) : 0;
}
export type Finding = { code: string; severity: 'warning' | 'error'; step: number; annotation?: number; width?: number; message: string; screenshot?: string };
export function editorialFindings(project: Project): Finding[] {
  const issues: Finding[] = [];
  project.steps.forEach((step, s) => {
    if (!step.hotspots.length) issues.push({ code: 'no-annotations', severity: 'warning', step: s + 1, message: 'Bu ekran açıklama içermiyor; açıklama gezinme denetiminin dışında kaldı.' });
    if (step.hotspots.length > 4) issues.push({ code: 'dense-step', severity: 'warning', step: s + 1, message: 'Bu ekranda dörtten fazla açıklama var. Aynı işi anlatan alanları birlikte anlatmayı değerlendirin.' });
    let previous = '';
    let changes = 0;
    step.hotspots.forEach((h, i) => {
      const add = (code: string, message: string) => issues.push({ code, severity: 'warning', step: s + 1, annotation: i + 1, message });
      if (h.description.length > 280) add('long-copy', 'Açıklama uzun; tek eylem ve kısa sonuç cümlesiyle sadeleştirin.');
      const camera = h.camera?.enabled ? h.camera : { x: 0, y: 0, w: 1, h: 1 };
      const current = [camera.x, camera.y, camera.w, camera.h].map(v => v.toFixed(3)).join(',');
      if (previous && current !== previous) changes++;
      previous = current;
      if (Math.max(1 / camera.w, 1 / camera.h) > 1.6) add('strong-zoom', 'Yakınlaştırma 1,6 katı aşıyor. Hedef okunuyorsa genel bağlamı koruyun.');
      if ((h.style === 'beacon' || h.style === 'both') && Math.min(h.w * step.image.width, h.h * step.image.height) < 48) add('marker-on-small-control', 'Daire işareti küçük kontrolün üstünü kapatabilir; çerçeveyi tercih edin.');
    });
    if (changes > 1) issues.push({ code: 'camera-churn', severity: 'warning', step: s + 1, message: 'Aynı ekranda kamera birden fazla kez değişiyor. Ortak ve sabit bir kadraj tercih edin.' });
  });
  return issues;
}

async function settle(page: Page) {
  await page.evaluate(async () => Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => undefined))));
}

export async function auditPlayer(browser: Browser, project: Project, out: string) {
  const findings = editorialFindings(project);
  const states: { step: number; annotation: number; width: number; status: string }[] = [];
  let screenshots = 0;
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(5000);
    page.on('pageerror', () => findings.push({ code: 'player-error', severity: 'error', step: 0, width, message: 'Oynatıcı JavaScript hatası verdi.' }));
    await page.route(/^https?:/, route => route.abort());
    try {
      await page.goto(pathToFileURL(join(out, 'preview.html')).href);
      if (await page.locator('#intro-start-btn').isVisible()) await page.locator('#intro-start-btn').click();
      for (let s = 0; s < project.steps.length; s++) {
        const step = project.steps[s];
        const go = async (index: number, h = 0) => {
          await page.locator('.pro-seg').nth(index).click();
          for (let j = 0; j < h; j++) await page.locator('.pro-nav.is-next').click();
          await settle(page);
        };
        try {
          await go(s);
          for (let h = 0; h < step.hotspots.length; h++) {
            const item = step.hotspots[h];
            if (!['auto', 'click', 'hover', 'goto'].includes(item.trigger)) throw new Error('Unsupported interaction');
            const at = { step: s + 1, annotation: h + 1, width };
            const target = page.locator('.hotspot.primary');
            await page.waitForFunction(id => document.querySelector('.hotspot.primary')?.getAttribute('data-hotspot-id') === id, item.id, { timeout: 5000 });
            if (await page.locator('#stage-image').getAttribute('src') !== step.image.dataUrl) throw new Error('Image mismatch');
            if (item.trigger === 'click') await target.click();
            if (item.trigger === 'hover') await target.hover();
            await settle(page);
            const metrics = await page.evaluate(() => {
              const target = document.querySelector('.hotspot.primary')!;
              const caption = document.querySelector<HTMLElement>('#tooltip');
              const image = document.querySelector<HTMLImageElement>('#stage-image')!;
              const visible = caption && getComputedStyle(caption).display !== 'none' && getComputedStyle(caption).visibility !== 'hidden' && caption.getBoundingClientRect().height > 0;
              const t = target.getBoundingClientRect();
              const c = caption?.getBoundingClientRect();
              return { target: { x: t.x, y: t.y, width: t.width, height: t.height }, caption: visible && c ? { x: c.x, y: c.y, width: c.width, height: c.height } : null,
                clipped: visible ? caption.scrollHeight > caption.clientHeight + 2 && getComputedStyle(caption).overflowY === 'hidden' : false,
                imageScale: image.getBoundingClientRect().width / image.naturalWidth,
                overflow: document.documentElement.scrollWidth > innerWidth + 2 };
            });
            const local: Finding[] = [];
            const add = (code: string, message: string, severity: 'warning' | 'error' = 'warning') => local.push({ ...at, code, message, severity });
            if (item.description && !metrics.caption) add('caption-missing', 'Açıklama metni beklenmesine rağmen kutu görünmüyor.', 'error');
            if (metrics.caption && overlap(metrics.target, metrics.caption) > .05) add('target-covered', 'Açıklama kutusu etkin hedefin üstüne geliyor.', 'error');
            if (metrics.caption && (metrics.caption.x < -1 || metrics.caption.y < -1 || metrics.caption.x + metrics.caption.width > width + 1 || metrics.caption.y + metrics.caption.height > 901)) add('caption-outside', 'Açıklama kutusu görünür ekranın dışına taşıyor.', 'error');
            if (metrics.clipped || metrics.overflow) add('content-clipped', 'Metin veya sayfa görünür alana sığmıyor.', 'error');
            if (Math.min(metrics.target.width, metrics.target.height) < (width < 768 ? 24 : 16)) add('small-target', 'Hedef küçük görünüyor; özellikle dokunmatik kullanımda ayrı kadrajı değerlendirin.');
            if (metrics.imageScale < .45 && h === 0) add('screen-downscaled', 'Kaynak ekran çok küçültülüyor. Görsel içindeki yazıların okunurluğunu gözle kontrol edin; bu ölçüm OCR değildir.');
            if (local.length && screenshots < 24) {
              const name = `quality-${width}-${s + 1}-${h + 1}.png`;
              await page.screenshot({ path: join(out, name) }); screenshots++;
              local.forEach(f => { f.screenshot = name; });
            }
            findings.push(...local);
            if (item.trigger === 'goto') {
              const destination = project.steps.findIndex(candidate => candidate.id === item.gotoStepId);
              if (destination < 0) throw new Error('Missing destination');
              await target.click();
              await settle(page);
              const destinationItem = project.steps[destination].hotspots[0];
              if (destinationItem) await page.waitForFunction(id => document.querySelector('.hotspot.primary')?.getAttribute('data-hotspot-id') === id, destinationItem.id, { timeout: 5000 });
              if (await page.locator('#stage-image').getAttribute('src') !== project.steps[destination].image.dataUrl) throw new Error('Wrong destination image');
              if (h + 1 < step.hotspots.length) await go(s, h + 1);
            } else if (h + 1 < step.hotspots.length) {
              await page.locator('.pro-nav.is-next').click();
              await settle(page);
            } else if (s + 1 < project.steps.length) {
              await page.locator('.pro-nav.is-next').click();
              await settle(page);
              if (await page.locator('#stage-image').getAttribute('src') !== project.steps[s + 1].image.dataUrl) throw new Error('Next screen failed');
            }
            states.push({ ...at, status: 'checked' });
          }
        } catch {
          findings.push({ step: s + 1, width, code: 'interaction-failed', severity: 'error', message: 'Bu ekranda hedef, açıklama veya geçiş doğrulanamadı. Kalan durumlar kontrol edilmiş sayılmaz.' });
        }
      }
    } finally { await page.close(); }
  }
  const expected = project.steps.reduce((sum, s) => sum + s.hotspots.length, 0) * 2;
  const errors = findings.filter(f => f.severity === 'error').length;
  const report = { version: 1, status: errors || states.length !== expected ? 'needs-fixes' : findings.length ? 'needs-review' : 'automated-checks-passed',
    expectedStates: expected, checkedStates: states.length, errors, warnings: findings.length - errors, findings, states,
    limitations: ['No OCR or semantic understanding of screenshot text', 'No source application mutations are replayed', 'Final completion, back navigation and unsupported interaction types require human review', 'No automatic camera, copy or layout changes'] };
  await writeJson(join(out, 'quality.json'), report);
  const lines = ['# Akış Kalite Raporu', '', `Durum: ${report.status}`, `Kontrol edilen açıklama: ${states.length}/${expected}`, `Hata: ${errors}; uyarı: ${report.warnings}`, '',
    'Uyarılar otomatik düzeltme veya kalite garantisi değildir. Kaynak uygulamada kayıt başarısı ayrıca doğrulanmalıdır.', '',
    ...findings.map(f => `- Ekran ${f.step}${f.annotation ? ` / Açıklama ${f.annotation}` : ''}${f.width ? ` / ${f.width}px` : ''}: **${f.code}** ${f.message}${f.screenshot ? ` [Görüntü](${f.screenshot})` : ''}`), '',
    '## Sınırlar', ...report.limitations.map(t => `- ${t}`)];
  await writeFile(join(out, 'QUALITY.md'), lines.join('\n'), { flag: 'wx' });
  return report;
}
