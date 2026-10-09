import { readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, basename, join } from 'node:path';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import { manifestSchema, validateLinks } from './schema.js';
import { assetPath, hash, newDirectory, readJson, writeJson } from './files.js';

export async function compile(manifestFile: string) {
  const manifest = manifestSchema.parse(await readJson(manifestFile));
  validateLinks(manifest.steps);
  const warnings: string[] = [];
  let total = 0;
  const steps = [];
  for (const step of manifest.steps) {
    const file = await assetPath(dirname(manifestFile), step.image);
    const size = (await stat(file)).size;
    total += size;
    if (size > 20 * 1024 * 1024 || total > 100 * 1024 * 1024) throw new Error('Image byte budget exceeded (20 MB/image, 100 MB/project)');
    const bytes = await readFile(file);
    let width: number, height: number, type: string;
    if (bytes.length >= 24 && bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') {
      width = bytes.readUInt32BE(16); height = bytes.readUInt32BE(20); type = 'image/png';
    } else if (bytes[0] === 255 && bytes[1] === 216) {
      const decoded = jpeg.decode(bytes, { useTArray: true, maxResolutionInMP: 16, maxMemoryUsageInMB: 128, tolerantDecoding: false });
      width = decoded.width; height = decoded.height; type = 'image/jpeg';
    } else throw new Error('Only real PNG and JPEG files are supported');
    if (!width || !height || width > 8192 || height > 8192 || width * height > 16777216) throw new Error('Image dimensions exceed the supported pixel budget');
    if (type === 'image/png') PNG.sync.read(bytes, { checkCRC: true });
    if (step.evidence && step.evidence.sha256 !== hash(bytes)) throw new Error(`Image hash mismatch: ${step.key}`);
    if (step.evidence?.viewport && (width !== step.evidence.viewport.width || height !== step.evidence.viewport.height)) {
      throw new Error(`Image and viewport dimensions differ: ${step.key}`);
    }
    if (!step.evidence || step.evidence.kind === 'provided-image') warnings.push(`${step.key}: user-supplied image; browser actions and provenance have not been verified.`);
    if (step.evidence?.fidelity === 'source-preview') warnings.push(`${step.key}: source-derived UI preview; host/backend behavior is not verified.`);
    if (step.evidence?.fidelity === 'reconstruction') warnings.push(`${step.key}: reconstructed UI, NOT a capture of the original application.`);
    const hotspots = step.annotations.map((a, i) => {
      const [x, y, w, h] = a.px;
      if (x + w > width || y + h > height) throw new Error(`Annotation outside image: ${step.key}/${i + 1}`);
      const camera = a.cameraPx;
      if (camera && (camera[0] + camera[2] > width || camera[1] + camera[3] > height)) throw new Error(`Camera outside image: ${step.key}/${i + 1}`);
      return {
        id: `annotation-${step.key}-${i + 1}`, label: a.label, showLabel: a.showLabel ?? Boolean(a.label), description: a.text,
        audio: null, placement: 'auto', style: a.style, trigger: a.trigger, value: '', options: [], answer: 0,
        gotoStepId: a.goto ? `step-${a.goto}` : '', spot: a.spot, markerStyle: 'number', markerColor: '#ffffff',
        markerPlacement: 'auto', backdrop: a.backdrop, x: x / width, y: y / height, w: w / width, h: h / height,
        camera: camera ? { enabled: true, x: camera[0] / width, y: camera[1] / height, w: camera[2] / width, h: camera[3] / height } : { enabled: false, x: 0, y: 0, w: 1, h: 1 }
      };
    });
    steps.push({ id: `step-${step.key}`, sectionId: 'section-main', title: step.title, body: '', audio: null,
      image: { name: basename(file), type, width, height, dataUrl: `data:${type};base64,${bytes.toString('base64')}` },
      hotspots, primaryHotspotId: hotspots[0]?.id ?? null });
  }
  const now = new Date().toISOString();
  const project = {
    version: 1,
    meta: { name: manifest.title, sidebarLabel: manifest.language === 'tr' ? 'Akış' : 'Flow', introDescription:
      manifest.steps.some(s => ['source-preview', 'reconstruction'].includes(s.evidence?.fidelity ?? ''))
        ? (manifest.language === 'tr' ? 'Bu akış kaynak önizlemesi veya yeniden oluşturulmuş arayüz içerir; gerçek uygulama davranışının doğrulaması değildir.' : 'This flow includes a source preview or reconstructed UI; it does not verify real application behavior.') : '',
      createdAt: now, updatedAt: now },
    theme: { presetId: 'ocean' },
    settings: { language: manifest.language, canvas: null, showProgress: true, autosaveEnabled: true,
      navigationMode: 'sidebar', sidebarStyle: 'visual', captionPlacement: 'near', template: 'classic' },
    sections: [{ id: 'section-main', title: manifest.language === 'tr' ? 'Genel' : 'General', collapsed: false }], steps
  };
  return { project, warnings, manifest };
}
export type Project = Awaited<ReturnType<typeof compile>>['project'];
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export async function build(manifestFile: string, destination: string) {
  const { project, warnings, manifest } = await compile(manifestFile);
  const out = await newDirectory(destination);
  await writeJson(join(out, 'project.ohig.json'), project);
  await writeJson(join(out, 'evidence.json'), { version: 1, steps: manifest.steps.map(s => ({ key: s.key, evidence: s.evidence ?? null })), warnings });
  const cards = project.steps.map((step, i) => `<article><h2>${i + 1}. ${escape(step.title)}</h2><div class="screen"><img alt="${escape(step.title)}" src="${step.image.dataUrl}">${step.hotspots.map((h, j) => `<span class="box" style="left:${h.x * 100}%;top:${h.y * 100}%;width:${h.w * 100}%;height:${h.h * 100}%"><b>${j + 1}</b></span>`).join('')}</div><ol>${step.hotspots.map(h => `<li>${escape(h.description)}</li>`).join('')}</ol></article>`).join('');
  await writeFile(join(out, 'review.html'), `<!doctype html><html lang="${project.settings.language}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(project.meta.name)}</title><style>body{margin:0;padding:2rem;background:#F9FAFB;color:#18181B;font:16px Geist,Arial,sans-serif}main{max-width:80rem;margin:auto}h1{font-size:2rem}h2{font-size:1rem}a{color:#3B82F6}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,28rem),1fr));gap:1.5rem}article{min-width:0;padding:1rem;border:1px solid #e2e8f0;border-radius:8px;background:white}.screen{position:relative}.screen img{width:100%;display:block}.box{position:absolute;box-sizing:border-box;border:2px solid #3B82F6;pointer-events:none}.box b{background:#3B82F6;color:white;padding:0 .25rem}li{margin:.5rem 0;overflow-wrap:anywhere}h1,h2{overflow-wrap:anywhere}</style><main><h1>${escape(project.meta.name)}</h1><p><a href="project.ohig.json" download>VisoReady JSON</a></p><p>${project.settings.language === 'tr' ? 'İnsan kontrolü bekliyor. Görselleri, alanları ve açıklamaları inceleyin; projeyi VisoReady içinden açın.' : 'Awaiting human review. Check images, regions and descriptions; open the project in VisoReady.'}</p>${warnings.map(w => `<p>${escape(w)}</p>`).join('')}<div class="grid">${cards}</div></main></html>`, { flag: 'wx' });
  return { out, steps: project.steps.length, warnings };
}
