import { resolve, join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { capture } from '../src/capture.js';
import { compile } from '../src/project.js';
import { checkEditor } from '../src/editor.js';
import { resolveEditor } from '../src/runtime.js';
import { newDirectory, writeJson } from '../src/files.js';
import { googleMapsCopy } from './google-maps-copy.js';

const out = await newDirectory(resolve(process.argv[2] || 'output/google-maps-walking-route-en'));
const button = (name: string) => ({ role: 'button' as const, name });
const textbox = (name: string) => ({ role: 'textbox' as const, name });
const reverse = button('Reverse starting point and destination');
const destination = textbox('Choose destination, or click on the map...');
const walking = '[role="radio"][data-tooltip="Walking"]';
const annotation = (target: unknown, key: string, next?: string) => ({
  target, ...googleMapsCopy[key], trigger: next ? 'goto' : 'auto', ...(next ? { goto: next } : {}),
  style: 'frame', spot: 'square', backdrop: false, showLabel: true
});
const recipe = {
  version: 1, title: 'Plan a Three-Stop Walking Route in Google Maps', language: 'en',
  fidelity: 'actual-source',
  startUrl: 'https://www.google.com/maps/search/Colosseum,+Rome/?hl=en&gl=us',
  allowedOrigins: ['https://www.google.com'], viewport: { width: 1440, height: 900 },
  steps: [
    {
      key: 'start', title: 'Start at the Colosseum',
      actions: [{ type: 'click', target: button('Directions') }], ready: reverse,
      annotations: [annotation(reverse, 'start', 'walking')]
    },
    {
      key: 'walking', title: 'Choose walking directions',
      actions: [{ type: 'click', target: reverse }], ready: walking,
      annotations: [annotation(walking, 'walking', 'pantheon')]
    },
    {
      key: 'pantheon', title: 'Set your first destination',
      actions: [{ type: 'click', target: walking }], ready: destination,
      annotations: [annotation(destination, 'pantheon', 'add-stop')]
    },
    {
      key: 'add-stop', title: 'Add another stop',
      actions: [
        { type: 'fill', target: destination, value: 'Pantheon, Rome' },
        { type: 'press', target: textbox('Destination Pantheon, Rome'), key: 'Enter' }
      ], ready: button('Add destination'),
      assertions: [{ target: '[role="main"]', containsText: 'Details' }],
      annotations: [annotation(button('Add destination'), 'add-stop', 'trevi')]
    },
    {
      key: 'trevi', title: 'Include Trevi Fountain',
      actions: [{ type: 'click', target: button('Add destination') }], ready: destination,
      annotations: [annotation(destination, 'trevi', 'review')]
    },
    {
      key: 'review', title: 'Review the complete route',
      actions: [
        { type: 'fill', target: destination, value: 'Trevi Fountain, Rome' },
        { type: 'press', target: textbox('Destination Trevi Fountain, Rome'), key: 'Enter' }
      ], ready: button('Add destination'),
      assertions: [{ target: '[role="main"]', containsText: 'Details' }],
      annotations: [annotation(button('Details'), 'review', 'details')]
    },
    {
      key: 'details', title: 'Check before you set off',
      actions: [{ type: 'click', target: button('Details') }],
      ready: button('Share directions'),
      annotations: [annotation(button('Share directions'), 'details')]
    }
  ]
};
const captureRecipe = { ...recipe, steps: recipe.steps.map(step => ({ ...step, settleMs: 3500 })) };
await writeJson(join(out, 'recipe.json'), captureRecipe);
console.log('Capturing real English Google Maps screens in a signed-out browser.');
const manifest = await capture(captureRecipe, join(out, 'captures'), { allowActions: true });
const { project, warnings } = await compile(manifest);
project.meta.introDescription = 'Explore Rome on foot: Colosseum, Pantheon, Trevi Fountain. An interactive tutorial captured from the real Google Maps interface. No account needed.';
await writeJson(join(out, 'project.ohig.json'), project);
await writeJson(join(out, 'build-warnings.json'), warnings);
await writeFile(join(out, 'capture-complete.txt'), 'Original screenshot bytes retained. No camera zoom, circle markers, or reconstructed UI.\n', { flag: 'wx' });
console.log('Capture complete. Checking the editable project and offline player.');
await checkEditor(join(out, 'project.ohig.json'), await resolveEditor(), join(out, 'verified'));
console.log(out);
