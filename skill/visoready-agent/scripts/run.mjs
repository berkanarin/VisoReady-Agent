import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';

try {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const config = JSON.parse(await readFile(join(root, 'runtime.json'), 'utf8'));
  const child = spawn(config.node, [join(config.packageRoot, 'dist', 'cli.js'), ...process.argv.slice(2)], { stdio: 'inherit' });
  child.on('error', () => { console.error('Runtime unavailable. Re-run VisoReady Agent setup from its project folder.'); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
} catch {
  console.error('Skill not installed. Run pnpm agent install-skill in the VisoReady Agent package.');
  process.exitCode = 1;
}
