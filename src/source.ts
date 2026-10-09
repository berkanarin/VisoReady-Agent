import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, join, relative, extname, isAbsolute } from 'node:path';
import { createServer } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { newDirectory } from './files.js';

const ignored = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'output', '.venv', 'vendor', '.auth', 'temp', 'bin', 'release']);
export async function inspectSource(directory: string) {
  const root = resolve(directory);
  if (!(await stat(root)).isDirectory()) throw new Error('Source must be a directory');
  const files: string[] = [];
  async function walk(dir: string, depth: number) {
    if (depth > 3 || files.length >= 400) return;
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => Number(a.isDirectory()) - Number(b.isDirectory()) || a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (files.length >= 400) break;
      if (entry.isSymbolicLink() || ignored.has(entry.name) || (entry.isDirectory() && entry.name.startsWith('.'))) continue;
      if (entry.name.startsWith('.env') && !['.env.example', '.env.sample'].includes(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full, depth + 1);
      else if (/\.(md|json|html|css|[cm]?[jt]sx?|cs|csproj|sln|ps1|py|toml|ya?ml)$/.test(entry.name) || entry.name.startsWith('.env.')) files.push(relative(root, full).replaceAll('\\', '/'));
    }
  }
  await walk(root, 0);
  let pkg: { scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string>; packageManager?: string } = {};
  if (files.includes('package.json')) pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
  const nativeFiles = files.filter(f => /\.(cs|csproj|sln)$/.test(f));
  const framework = dependencies.next ? 'next' : dependencies.vite ? 'vite' : nativeFiles.length ? 'native' : files.includes('index.html') && !files.includes('package.json') ? 'static' : 'manual';
  const envNames = new Set<string>();
  for (const name of files.filter(f => /(^|\/)\.env\.(example|sample)$/.test(f))) {
    const content = await readFile(join(root, name), 'utf8');
    for (const match of content.matchAll(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)) envNames.add(match[1]);
  }
  return {
    root, framework, inventoryMayBeTruncated: files.length >= 400, maxDepth: 3, packageManager: pkg.packageManager ?? null, scripts: pkg.scripts ?? {},
    environmentNames: [...envNames], files,
    workspace: files.filter(f => f.endsWith('package.json')),
    next: framework === 'native' ? 'Native application: Playwright cannot control the host UI. Inspect native capture/test tools. A browser preview is not proof of native behavior.' : framework === 'manual' ? 'Inspect README and app packages; choose the real frontend root and startup procedure. No automatic execution.' :
      framework === 'static' ? 'Static preview supported by run-source.' : 'Review scripts and dependencies. Install with pnpm only after authorization; then run-source with --allow-run.',
    fidelity: 'Existing source only. Reconstructed interfaces must be a separate, explicitly approved simulation, never labeled as captured production UI.'
  };
}
export async function cloneSource(url: string, directory: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('Use a credential-free HTTPS repository URL');
  const out = await newDirectory(directory);
  await promisify(execFile)('git', ['clone', '--depth', '1', '--no-recurse-submodules', '--', parsed.href, out], { timeout: 120000 });
  return inspectSource(out);
}
export async function staticServer(directory: string, port = 0) {
  const root = resolve(directory);
  const server = createServer(async (req, res) => {
    try {
      const name = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
      const file = resolve(root, '.' + (name.endsWith('/') ? name + 'index.html' : name));
      const rel = relative(root, file);
      if (rel.startsWith('..') || isAbsolute(rel) || rel.split(/[\\/]/).some(p => p.startsWith('.') || ignored.has(p))) throw new Error('Not served');
      const { realpath } = await import('node:fs/promises');
      const resolved = await realpath(file), resolvedRoot = await realpath(root);
      const actual = relative(resolvedRoot, resolved);
      if (actual.startsWith('..') || isAbsolute(actual)) throw new Error('Not served');
      const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
      res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(await readFile(file));
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  await new Promise<void>((ok, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', ok); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing server address');
  return { url: `http://127.0.0.1:${address.port}`, close: async () => {
    server.closeAllConnections();
    await new Promise<void>((ok, reject) => server.close(e => e ? reject(e) : ok()));
  } };
}
async function portAvailable(port: number) {
  const server = createTcpServer();
  await new Promise<void>((ok, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', ok); });
  await new Promise<void>(ok => server.close(() => ok()));
}
export async function startSource(directory: string, port: number, script: string, allowRun: boolean) {
  const report = await inspectSource(directory);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Choose a port between 1024 and 65535');
  if (report.framework === 'static') return staticServer(directory, port);
  if (!allowRun) throw new Error('Repository scripts execute arbitrary code. Review first, then use --allow-run');
  if (!['vite', 'next'].includes(report.framework)) throw new Error('Unsupported startup: inspect the project and start it manually, then capture its URL');
  if (!/^[a-zA-Z0-9:_-]+$/.test(script) || !report.scripts[script]) throw new Error('Choose an existing package.json script');
  const pnpm = process.env.npm_execpath;
  if (!pnpm || !pnpm.toLowerCase().includes('pnpm')) throw new Error('Run this command through pnpm agent so the pnpm executable is known');
  await portAvailable(port);
  const flags = report.framework === 'next' ? ['--hostname', '127.0.0.1', '--port', String(port)] : ['--host', '127.0.0.1', '--port', String(port), '--strictPort'];
  const child = spawn(process.execPath, [pnpm, 'run', script, ...flags], { cwd: directory, stdio: 'ignore', detached: process.platform !== 'win32' });
  let spawnError: Error | undefined;
  child.on('error', error => { spawnError = error; });
  const close = async () => {
    if (!child.pid) return;
    if (process.platform === 'win32') {
      await promisify(execFile)('taskkill', ['/pid', String(child.pid), '/T', '/F']).catch(() => undefined);
    } else { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* Already exited. */ } }
  };
  const url = `http://127.0.0.1:${port}`;
  try {
    for (let i = 0; i < 120; i++) {
      if (spawnError || child.exitCode !== null) throw new Error('Startup failed; inspect the project in a terminal');
      try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return { url, close }; } catch { /* Wait for readiness, not a fixed capture delay. */ }
      await new Promise(r => setTimeout(r, 500));
    }
    throw new Error('Source did not become ready in time; check environment and backend requirements');
  } catch (error) { await close(); throw error; }
}
