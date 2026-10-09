import { mkdir, readdir, lstat, copyFile, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (process.argv.length !== 4 || process.argv[2] !== '--out') throw new Error('Use node scripts/release.mjs --out <new-directory>');
const out = resolve(process.argv[3]);
await mkdir(out, { recursive: false });
const files = [];
const extensions = new Set(['.ts', '.js', '.mjs', '.json', '.yaml', '.md', '.html', '.css', '.svg', '.png', '.jpg']);
async function copy(source, relative) {
  const info = await lstat(source);
  if (info.isSymbolicLink()) throw new Error(`Symlink not allowed: ${relative}`);
  if (info.isDirectory()) {
    for (const entry of await readdir(source)) {
      if (entry.startsWith('.') || !extensions.has(extname(entry)) && !(await lstat(join(source, entry))).isDirectory()) throw new Error(`Unexpected release file: ${relative}/${entry}`);
      await copy(join(source, entry), `${relative}/${entry}`);
    }
    return;
  }
  await mkdir(dirname(join(out, relative)), { recursive: true });
  await copyFile(source, join(out, relative));
  files.push({ path: relative, sha256: createHash('sha256').update(await readFile(source)).digest('hex'), bytes: info.size });
}
// Allowlist excludes private captures, native examples, runtime metadata and local dependencies.
for (const name of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json', 'tsconfig.build.json', 'eslint.config.js', '.gitignore', 'Setup.ps1', 'README.md', 'INSTALL.md', 'RELEASE-CHECKLIST.md', 'LICENSE', 'THIRD-PARTY-NOTICES.md', 'src', 'skill', 'scripts', 'tests', 'examples/demo-app', 'examples/demo.recipe.json']) await copy(join(root, name), name);
const bundled = join(root, 'VisoReady.html');
let editor = bundled;
try { await lstat(bundled); } catch { editor = join(root, '..', 'VisoReady.html'); }
await copy(editor, 'VisoReady.html');
for (const name of ['examples/google-maps-walking-route.ts', 'examples/google-maps-copy.ts', 'demos/google-maps-walking-route', 'docs/assets/visoready-agent-cover.png', '.github/workflows/ci.yml', '.nojekyll', '.gitattributes']) await copy(join(root, name), name);
await writeFile(join(out, 'RELEASE-MANIFEST.json'), JSON.stringify({ version: 1, packageVersion: JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version, files: files.sort((a, b) => a.path.localeCompare(b.path)) }, null, 2));
console.log(JSON.stringify({ out, files: files.length, published: false }));
