import { existsSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { findProjectRoot, log, logError, resolveDevPort } from '../utils.js';
import { preflight, releasePort, openTunnel, closeTunnel , killProcessTree, devServerSpawnOpts }
  from './preflight.js';

/**
 * Start the dev server and its adb reverse tunnel, without touching the APK.
 *
 * The tunnel is the reason this exists. `dev` removes it on exit, so restarting
 * with a bare `npm run dev` leaves a working server the device cannot reach — the
 * plugin reports "Dev server not running" while Vite is plainly up.
 */
export async function serve(opts: { port?: number } = {}): Promise<void> {
  const root = findProjectRoot();
  if (!root) {
    logError('Could not find settings.gradle. Run this from an ATAK plugin project root.');
    process.exit(1);
  }

  const webDir = join(root, 'web');
  if (!existsSync(join(webDir, 'package.json'))) {
    logError('web/ folder not found. Run "atak-reactive init" first.');
    process.exit(1);
  }
  if (!existsSync(join(webDir, 'node_modules'))) {
    logError('web/ dependencies not installed. Run:\n  npm install --prefix web');
    process.exit(1);
  }

  const port = resolveDevPort(root, opts.port);
  console.log(`\n  atak-reactive serve (port: ${port})\n`);

  const held = await preflight(port);

  // serve makes no claim about what is installed. The port is compiled into the
  // APK, so if it changed since the last build the plugin is still probing the old
  // one and only `dev` can fix that.
  log(`Assumes the installed APK was built for port ${port} — run "dev" if it changed.`);

  await openTunnel(port, () => releasePort(held));
  await releasePort(held);

  log('Starting Vite dev server...\n');
  const vite = spawn(
    'npx',
    ['vite', '--host', '--port', String(port), '--strictPort'],
    {
      cwd: webDir,
      ...devServerSpawnOpts,
      env: { ...process.env, ATAK_DEV_PORT: String(port) },
    },
  );

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    killProcessTree(vite);
    closeTunnel(port);
  };

  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });
  process.on('exit', cleanup);

  vite.on('exit', (code) => {
    cleanup();
    if (code) logError(`Vite exited (code ${code}). Pass --port <n> if ${port} was taken.`);
    process.exit(code ?? 0);
  });
}
