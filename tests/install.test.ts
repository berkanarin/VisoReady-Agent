import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installSkill, packageRoot } from '../src/install.js';
import { resolveEditor } from '../src/runtime.js';

test('isolated installs update stale runtime paths and preserve unrelated skills', async () => {
  const root = await mkdtemp(join(tmpdir(), 'visoready-install-'));
  await installSkill('both', root);
  const metadata = join(root, 'codex/skills/visoready-agent/runtime.json');
  await writeFile(metadata, JSON.stringify({ packageRoot, node: 'old-node', version: 1 }));
  await installSkill('codex', root);
  assert.equal(JSON.parse(await readFile(metadata, 'utf8')).node, process.execPath);
  const other = await mkdtemp(join(tmpdir(), 'visoready-foreign-'));
  const target = join(other, 'codex/skills/visoready-agent');
  await mkdir(target, { recursive: true });
  await writeFile(join(target, 'SKILL.md'), 'User-owned instructions');
  await assert.rejects(installSkill('codex', other), /Existing skill/);
  assert.equal(await readFile(join(target, 'SKILL.md'), 'utf8'), 'User-owned instructions');
  await assert.rejects(installSkill('unknown', root), /Client/);
  const mixed = await mkdtemp(join(tmpdir(), 'visoready-mixed-'));
  await mkdir(join(mixed, 'claude/skills/visoready-agent'), { recursive: true });
  await writeFile(join(mixed, 'claude/skills/visoready-agent/SKILL.md'), 'Other owner');
  await assert.rejects(installSkill('both', mixed), /Existing skill/);
  await assert.rejects(readFile(join(mixed, 'codex/skills/visoready-agent/SKILL.md')));
});

test('editor resolver supports the checked-out repository or standalone release', async () => {
  const editor = await resolveEditor();
  assert(editor.endsWith('VisoReady.html'));
  assert((await readFile(editor, 'utf8')).includes('GuideMakerExporters'));
});
