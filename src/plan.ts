import { z } from 'zod';
import { resolve, join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { assetPath, newDirectory, readJson, writeJson } from './files.js';

export const catalogSchema = z.strictObject({
  version: z.literal(1),
  project: z.string().min(1),
  sourceDirectory: z.string().min(1),
  guides: z.array(z.strictObject({
    id: z.string().regex(/^[a-z0-9_-]+$/),
    title: z.string().min(1),
    goal: z.string().min(1),
    captureMode: z.enum(['browser', 'native', 'source-preview']),
    prerequisites: z.array(z.string()),
    outline: z.array(z.string()).min(1),
    evidence: z.array(z.strictObject({ file: z.string().min(1), line: z.number().int().positive() })).min(1)
  })).min(1)
});
export async function savePlan(file: string, destination: string) {
  const catalog = catalogSchema.parse(await readJson(file));
  catalog.sourceDirectory = resolve(catalog.sourceDirectory);
  if (new Set(catalog.guides.map(g => g.id)).size !== catalog.guides.length) throw new Error('Guide IDs must be unique');
  for (const guide of catalog.guides) for (const evidence of guide.evidence) {
    const source = await assetPath(catalog.sourceDirectory, evidence.file);
    const lines = (await readFile(source, 'utf8')).split(/\r?\n/);
    if (evidence.line > lines.length) throw new Error('Evidence line does not exist');
  }
  const out = await newDirectory(destination);
  await writeJson(join(out, 'plan.json'), catalog);
  const text = `# ${catalog.project}\n\nStatus: awaiting user selection. No capture or source execution has started.\n\n` + catalog.guides.map(g =>
    `## ${g.id}: ${g.title}\n\n${g.goal}\n\nCapture: ${g.captureMode}\n\n` +
    g.prerequisites.map(p => `- Prerequisite: ${p}`).join('\n') + '\n\n' +
    g.outline.map((s, i) => `${i + 1}. ${s}`).join('\n') + '\n\nEvidence: ' + g.evidence.map(e => `${e.file}:${e.line}`).join(', ')
  ).join('\n\n');
  await writeFile(join(out, 'GUIDES.md'), text + '\n', { flag: 'wx' });
  return out;
}
export async function selectGuides(file: string, ids: string[], destination: string) {
  const plan = catalogSchema.parse(await readJson(file));
  if (!ids.length || ids.some(id => !plan.guides.some(g => g.id === id))) throw new Error('Select existing guide IDs');
  const selection = { ...plan, guides: plan.guides.filter(g => ids.includes(g.id)), selectedAt: new Date().toISOString(),
    note: 'Scope selection only; not permission to install dependencies, run untrusted code or mutate production data.' };
  const out = await newDirectory(destination);
  await writeJson(join(out, 'selection.json'), selection);
  return out;
}
