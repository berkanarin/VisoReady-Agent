import { z } from 'zod';

const text = z.string().trim().min(1).max(4000);
const key = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const httpUrl = z.url().refine(value => {
  const url = new URL(value);
  return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
}, 'Use an HTTP(S) URL without embedded credentials');
export const locatorSchema = z.union([
  text,
  z.strictObject({ role: z.enum(['button', 'link', 'textbox', 'combobox', 'checkbox', 'radio', 'tab', 'heading', 'menuitem']), name: text }),
  z.strictObject({ label: text }),
  z.strictObject({ testId: text })
]);
export type Target = z.infer<typeof locatorSchema>;
export const viewportSchema = z.strictObject({
  width: z.number().int().min(320).max(3840),
  height: z.number().int().min(240).max(2160)
});
const annotationFields = {
  text,
  style: z.enum(['frame', 'both', 'beacon', 'none']).default('frame'),
  spot: z.enum(['auto', 'square', 'rounded', 'pill', 'circle']).default('square'),
  backdrop: z.boolean().default(false),
  showLabel: z.boolean().default(false),
  label: z.string().max(200).default(''),
  trigger: z.enum(['auto', 'click', 'hover', 'goto']).default('click'),
  goto: key.optional()
};
const actionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('goto'), url: httpUrl }),
  z.strictObject({ type: z.literal('click'), target: locatorSchema }),
  z.strictObject({ type: z.literal('fill'), target: locatorSchema, value: z.string().max(4000) }),
  z.strictObject({ type: z.literal('fillSecret'), target: locatorSchema, env: z.string().regex(/^[A-Z][A-Z0-9_]+$/) }),
  z.strictObject({ type: z.literal('press'), target: locatorSchema, key: text }),
  z.strictObject({ type: z.literal('select'), target: locatorSchema, value: text }),
  z.strictObject({ type: z.literal('check'), target: locatorSchema, checked: z.boolean() }),
  z.strictObject({ type: z.literal('scroll'), target: locatorSchema }),
  z.strictObject({ type: z.literal('wait'), target: locatorSchema, state: z.enum(['visible', 'hidden']).default('visible') })
]);
const base = {
  version: z.literal(1),
  title: text,
  language: z.enum(['tr', 'en']).default('tr')
};
export const recipeSchema = z.strictObject({
  ...base,
  fidelity: z.enum(['actual-source', 'source-preview', 'reconstruction']).default('actual-source'),
  startUrl: httpUrl,
  allowedOrigins: z.array(httpUrl.refine(v => new URL(v).origin === v, 'Use an exact origin without a trailing slash')).min(1).max(20),
  viewport: viewportSchema.default({ width: 1440, height: 810 }),
  masks: z.array(locatorSchema).default([]),
  steps: z.array(z.strictObject({
    key,
    title: text,
    actions: z.array(actionSchema).max(50).default([]),
    ready: locatorSchema.optional(),
    settleMs: z.number().int().min(0).max(10000).default(0),
    assertions: z.array(z.strictObject({ target: locatorSchema, containsText: text })).max(20).default([]),
    annotations: z.array(z.strictObject({ ...annotationFields, target: locatorSchema })).max(30).default([])
  })).min(1).max(100)
});
const box = z.tuple([z.number().nonnegative(), z.number().nonnegative(), z.number().positive(), z.number().positive()]);
export const manifestSchema = z.strictObject({
  ...base,
  steps: z.array(z.strictObject({
    key,
    title: text,
    image: text,
    annotations: z.array(z.strictObject({ ...annotationFields, px: box, cameraPx: box.optional() })).max(30).default([]),
    evidence: z.strictObject({
      kind: z.enum(['browser', 'native', 'provided-image']),
      application: z.string().optional(),
      coordinateSource: z.enum(['dom', 'visual']).optional(),
      fidelity: z.enum(['actual-source', 'source-preview', 'reconstruction']).optional(),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      capturedAt: z.iso.datetime(),
      url: httpUrl.optional(),
      viewport: viewportSchema.optional(),
      scroll: z.strictObject({ x: z.number(), y: z.number() }).optional(),
      assertionsPassed: z.number().int().nonnegative().optional()
    }).optional()
  })).min(1).max(100)
});
export type Recipe = z.infer<typeof recipeSchema>;
export type Manifest = z.infer<typeof manifestSchema>;

export function validateLinks(steps: { key: string; annotations: { trigger: string; goto?: string }[] }[]) {
  const keys = new Set(steps.map(s => s.key));
  if (keys.size !== steps.length) throw new Error('Step keys must be unique');
  for (const step of steps) for (const annotation of step.annotations) {
    if (annotation.trigger === 'goto' && (!annotation.goto || !keys.has(annotation.goto))) {
      throw new Error(`Step ${step.key}: goto must reference an existing step key`);
    }
    if (annotation.trigger !== 'goto' && annotation.goto) throw new Error(`Step ${step.key}: goto requires trigger goto`);
  }
}
