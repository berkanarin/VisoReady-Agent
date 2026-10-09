import { cp, mkdir, access, readFile, writeFile, lstat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { writeJson } from './files.js';
import { packageRoot } from './runtime.js';
export { packageRoot } from './runtime.js';

export async function installSkill(client: string, installRoot?: string) {
  if (!['codex', 'claude', 'both'].includes(client)) throw new Error('Client must be codex, claude or both');
  await access(join(packageRoot, 'dist', 'cli.js'));
  const roots = client === 'both' ? ['codex', 'claude'] : [client];
  const installed: string[] = [];
  const destinations: { target: string; update: boolean }[] = [];
  // Preflight every client before writing either installation.
  for (const name of roots) {
    const home = installRoot ? join(resolve(installRoot), name) : name === 'codex' ? (process.env.CODEX_HOME || join(homedir(), '.codex')) : join(homedir(), '.claude');
    const target = join(home, 'skills', 'visoready-agent');
    try {
      const info = await lstat(target);
      if (info.isSymbolicLink() || !info.isDirectory()) throw new Error(`Unsafe skill target: ${target}`);
      const current = JSON.parse(await readFile(join(target, 'runtime.json'), 'utf8'));
      if (current.packageRoot === packageRoot) {
        destinations.push({ target, update: true }); continue;
      }
      throw new Error('A different installation exists');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      // Do not overwrite an existing skill even when it lacks our runtime metadata.
      try { await lstat(target); throw new Error(`Existing skill at ${target}; no files overwritten`); }
      catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
    }
    destinations.push({ target, update: false });
  }
  for (const { target, update } of destinations) {
    await mkdir(dirname(target), { recursive: true });
    await cp(join(packageRoot, 'skill', 'visoready-agent'), target, { recursive: true, errorOnExist: !update, force: update });
    const metadata = { packageRoot, node: process.execPath, version: 1 };
    if (update) await writeFile(join(target, 'runtime.json'), JSON.stringify(metadata, null, 2) + '\n');
    else await writeJson(join(target, 'runtime.json'), metadata);
    installed.push(target + (update ? ' (updated)' : ''));
  }
  return installed;
}
