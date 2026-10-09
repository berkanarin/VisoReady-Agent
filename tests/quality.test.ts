import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overlap, editorialFindings } from '../src/quality.js';
import { manifestSchema, recipeSchema } from '../src/schema.js';
import type { Project } from '../src/project.js';

test('overlap is measured against target area, not caption area', () => {
  const target = { x: 10, y: 10, width: 20, height: 20 };
  assert.equal(overlap(target, { x: 0, y: 0, width: 200, height: 200 }), 1);
  assert.equal(overlap(target, { x: 20, y: 10, width: 20, height: 20 }), .5);
  assert.equal(overlap(target, { x: 30, y: 10, width: 20, height: 20 }), 0);
  assert.equal(overlap({ ...target, width: 0 }, target), 0);
});

test('new manifests get calm defaults; explicit old choices survive', () => {
  const make = (extra = {}) => manifestSchema.parse({ version: 1, title: 'Test', steps: [{ key: 'a', title: 'A', image: 'a.png', annotations: [{ text: 'Read', px: [0, 0, 10, 10], ...extra }] }] }).steps[0].annotations[0];
  assert.deepEqual([make().style, make().spot, make().backdrop, make().showLabel], ['frame', 'square', false, false]);
  assert.equal(make({ style: 'both', backdrop: true }).style, 'both');
  assert.equal(make({ backdrop: true }).backdrop, true);
});

test('camera churn ignores a stable focus and reports repeated moves', () => {
  const hotspot = { description: 'Short', style: 'frame', w: .2, h: .2, camera: { enabled: true, x: 0, y: 0, w: .8, h: .8 } };
  const p = { steps: [{ image: { width: 1440, height: 960 }, hotspots: [hotspot, hotspot, hotspot] }] } as unknown as Project;
  assert.equal(editorialFindings(p).length, 0);
  p.steps[0].hotspots = [hotspot, { ...hotspot, camera: { ...hotspot.camera, x: .1 } }, hotspot] as Project['steps'][number]['hotspots'];
  assert(editorialFindings(p).some(f => f.code === 'camera-churn'));
  p.steps[0].hotspots[1].camera.w = .4;
  assert(editorialFindings(p).some(f => f.code === 'strong-zoom'));
});

test('assertions are bounded, declarative and cannot execute code', () => {
  const base = { version: 1, title: 'Test', startUrl: 'http://localhost:3000', allowedOrigins: ['http://localhost:3000'], steps: [{ key: 'a', title: 'A', assertions: [{ target: '#result', containsText: 'Saved' }] }] };
  assert.equal(recipeSchema.parse(base).steps[0].assertions.length, 1);
  assert.throws(() => recipeSchema.parse({ ...base, steps: [{ ...base.steps[0], assertions: [{ target: '#result', script: 'evil()' }] }] }));
});
