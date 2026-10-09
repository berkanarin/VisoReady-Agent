import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspace = await mkdtemp(join(tmpdir(), 'VisoReady release test '));
const bundle = join(workspace, 'standalone package');
const homes = join(workspace, 'isolated skills');
const env = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: join(workspace, 'browsers') };
const steps = [];
function run(command, args, cwd, shell = false) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', shell, maxBuffer: 8 * 1024 * 1024, timeout: 600000 });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed\n${result.error?.message || ''}\n${result.stdout}\n${result.stderr}`);
  steps.push(args.join(' '));
  console.log(`PASS: ${args.join(' ')}`);
  return result.stdout;
}
try {
  run(process.execPath, [join(root, 'scripts/release.mjs'), '--out', bundle], root);
  const manifest = JSON.parse(await readFile(join(bundle, 'RELEASE-MANIFEST.json'), 'utf8'));
  for (const file of manifest.files) {
    const bytes = await readFile(join(bundle, file.path));
    if (createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error(`Hash mismatch: ${file.path}`);
    if (/(^|\/)(node_modules|output|runtime\.json|\.env|\.auth)(\/|$)/.test(file.path)) throw new Error('Private/generated file in bundle');
  }
  for (const args of [['install', '--frozen-lockfile', '--store-dir', '.pnpm-store'], ['run', 'build'], ['exec', 'playwright', 'install', 'chromium'], ['lint'], ['typecheck'], ['test'], ['test:e2e']]) run('pnpm', args, bundle, process.platform === 'win32');
  const cli = join(bundle, 'dist/cli.js');
  const doctor = JSON.parse(run(process.execPath, [cli, 'doctor'], bundle));
  if (resolve(doctor.editor) !== join(bundle, 'VisoReady.html')) throw new Error('Doctor used an editor outside the bundle');
  run(process.execPath, [cli, 'install-skill', '--client', 'both', '--install-root', homes], bundle);
  run(process.execPath, [cli, 'install-skill', '--client', 'both', '--install-root', homes], bundle);
  for (const client of ['codex', 'claude']) {
    const runner = join(homes, client, 'skills/visoready-agent/scripts/run.mjs');
    const result = JSON.parse(run(process.execPath, [runner, 'doctor'], workspace));
    if (resolve(result.packageRoot) !== bundle) throw new Error('Skill runner escaped the isolated package');
  }
  run(process.execPath, [join(bundle, 'dist/demo.js')], workspace);
  await writeFile(join(workspace, 'SMOKE-RESULT.json'), JSON.stringify({ passed: true, platform: process.platform, node: process.version, steps,
    isolation: ['new package path with spaces', 'separate pnpm store', 'separate Chromium download', 'separate Codex and Claude skill roots'],
    notVerified: ['fresh operating system', 'real Claude Code conversation', 'real Codex new-session discovery', 'other operating systems'] }, null, 2));
  await mkdir(join(root, 'output'), { recursive: true });
  await writeFile(join(root, 'output', `release-smoke-${Date.now()}.json`), await readFile(join(workspace, 'SMOKE-RESULT.json')));
  console.log(`Smoke passed. Local evidence: ${workspace}`);
} catch (error) {
  await writeFile(join(workspace, 'SMOKE-RESULT.json'), JSON.stringify({ passed: false, steps, error: String(error) }, null, 2));
  console.error(`Smoke failed. Evidence: ${workspace}\n${error}`);
  process.exitCode = 1;
}
