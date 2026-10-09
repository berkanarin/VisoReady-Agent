import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('node scripts/setup.mjs [--client codex|claude|both]\nRequires Node 22.13+ and the pnpm version in package.json.');
  process.exit(0);
}
const client = args.length === 0 ? 'both' : args.length === 2 && args[0] === '--client' ? args[1] : '';
if (!['codex', 'claude', 'both'].includes(client)) throw new Error('Use --client codex, claude or both.');
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || major === 22 && minor < 13) throw new Error('Node.js 22.13+ is required.');
if (!existsSync(join(root, 'VisoReady.html')) && !existsSync(join(root, '..', 'VisoReady.html'))) throw new Error('Download the complete repository/release: VisoReady.html is missing.');
const required = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).packageManager;
const version = spawnSync('pnpm', ['--version'], { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' });
if (version.status !== 0 || `pnpm@${version.stdout.trim()}` !== required) throw new Error(`Install ${required} before setup. No dependency changes made.`);
// Windows shell arguments below are fixed literals or an enumerated client name.
for (const command of [['install', '--frozen-lockfile'], ['run', 'build'], ['exec', 'playwright', 'install', 'chromium'], ['agent', 'doctor'], ['agent', 'install-skill', '--client', client]]) {
  const result = spawnSync('pnpm', command, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('Ready. Start a new Codex or Claude Code session. Keep this package folder in place.');
