import { access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export async function resolveEditor() {
  for (const file of [join(packageRoot, 'VisoReady.html'), join(packageRoot, '..', 'VisoReady.html')]) {
    try { await access(file); return file; } catch { /* Try repository layout. */ }
  }
  throw new Error('VisoReady.html is missing. Download the complete repository or release package, not only the skill folder.');
}
