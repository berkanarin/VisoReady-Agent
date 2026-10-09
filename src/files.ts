import { mkdir, readFile, writeFile, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute, dirname } from 'node:path';
import { createHash } from 'node:crypto';

export async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, 'utf8'));
}
export const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');
export async function newDirectory(dir: string) {
  const path = resolve(dir);
  await mkdir(dirname(path), { recursive: true });
  await mkdir(path); // Existing runs are never silently overwritten.
  return path;
}
export async function writeJson(file: string, value: unknown) {
  await writeFile(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
}
export async function assetPath(root: string, name: string) {
  if (isAbsolute(name)) throw new Error('Image paths must be relative to the manifest');
  const base = await realpath(root);
  const file = await realpath(resolve(base, name));
  const rel = relative(base, file);
  if (rel === '..' || rel.startsWith('..\\') || rel.startsWith('../') || isAbsolute(rel)) {
    throw new Error('Image path escapes the manifest directory');
  }
  return file;
}
