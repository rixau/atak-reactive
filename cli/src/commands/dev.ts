import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync, spawn, type ChildProcess } from 'child_process';
import {
  findProjectRoot,
  log,
  logError,
  logDone,
  resolveDevPort,
  newestApk,
} from '../utils.js';
import {
  preflightDevice,
  preflightPort,
  releasePort,
  openTunnel,
  closeTunnel,
  killProcessTree,
  devServerSpawnOpts,
} from './preflight.js';

export interface DevOpts {
  port?: number;
}

/** Locate the plugin project and its web/ folder, or exit with a usable message. */
function resolveProject(): { root: string; webDir: string } {
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
  return { root, webDir };
}

/** Build the debug APK and install it. No dev server, no tunnel. */
function buildAndInstall(root: string, flavor: string, port: number): void {
  const capFlavor = flavor.charAt(0).toUpperCase() + flavor.slice(1);
  log(`Building debug APK (${capFlavor}Debug)...`);
  try {
    const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
    const buildGradle = join(root, 'app', 'build.gradle');
    const gradleSrc = existsSync(buildGradle) ? readFileSync(buildGradle, 'utf-8') : '';
    // init wires `preBuild.dependsOn buildWebAssets`, an Exec task with no declared
    // inputs/outputs, so it always re-runs. Dev mode serves from Vite anyway.
    const skipWeb = gradleSrc.includes('buildWebAssets') ? ' -x buildWebAssets' : '';

    if (gradleSrc && !gradleSrc.includes('atak_reactive_dev_port')) {
      log(`Warning: no atak_reactive_dev_port resValue — plugin falls back to 5173.`);
      log(`  Run "atak-reactive init" to add it.`);
    }

    execSync(
      `${gradlew} assemble${capFlavor}Debug${skipWeb} -PdevServerPort=${port}`,
      { cwd: root, stdio: 'inherit' },
    );
  } catch {
    logError('Gradle build failed.');
    process.exit(1);
  }

  log('Installing APK...');
  const apkDir = join(root, 'app', 'build', 'outputs', 'apk', flavor, 'debug');
  // Newest by mtime — filenames embed a git sha, so stale APKs accumulate and
  // readdir order would happily install an old one.
  const apk = newestApk(apkDir);
  if (!apk) {
    logError(`No APK found in ${apkDir}`);
    process.exit(1);
  }
  try {
    execSync(`adb install -r "${join(apkDir, apk)}"`, { stdio: 'inherit' });
    log(`APK installed (${apk}).`);
  } catch {
    logError('APK install failed.');
    process.exit(1);
  }
}

/**
 * Open the tunnel and run Vite until interrupted. `held` is the port reservation
 * from preflightPort, released immediately before Vite binds.
 */
async function runServer(
  webDir: string,
  port: number,
  held: Awaited<ReturnType<typeof preflightPort>>,
): Promise<void> {
  // Registered before the tunnel is opened: a Ctrl+C in the window between
  // opening it and installing these handlers would otherwise leak the tunnel and
  // block the next run's preflight.
  let tunnelOpen = false;
  let vite: ChildProcess | undefined;
  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (vite) killProcessTree(vite);
    if (tunnelOpen) closeTunnel(port);
  };
  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });
  process.on('SIGHUP', () => { cleanup(); process.exit(0); });
  process.on('exit', cleanup);

  await openTunnel(port, () => releasePort(held));
  tunnelOpen = true;
  await releasePort(held);

  log('Starting Vite dev server...\n');
  vite = spawn(
    'npx',
    ['vite', '--host', '--port', String(port), '--strictPort'],
    {
      cwd: webDir,
      ...devServerSpawnOpts,
      // Scoped to this process rather than written to .env.local, which would
      // outlive the run and silently override local.properties next time.
      env: { ...process.env, ATAK_DEV_PORT: String(port) },
    },
  );

  vite.on('exit', (code) => {
    cleanup();
    if (code) logError(`Vite exited (code ${code}). Pass --port <n> if ${port} was taken.`);
    process.exit(code ?? 0);
  });
}

/** `dev` — build, install, tunnel, serve. */
export async function dev(flavor: string = 'civ', opts: DevOpts = {}): Promise<void> {
  const { root, webDir } = resolveProject();
  const port = resolveDevPort(root, opts.port);
  console.log(`\n  atak-reactive dev (flavor: ${flavor}, port: ${port})\n`);

  const serial = preflightDevice();
  const held = await preflightPort(port);
  log(`Preflight OK — device ${serial}, port ${port} reserved`);

  buildAndInstall(root, flavor, port);
  await runServer(webDir, port, held);
}

/**
 * `dev install` — build and install only. Use when the APK changed but a dev
 * server is already running: reinstalling resets ATAK's per-plugin "should load"
 * preference, so it is worth avoiding when nothing native changed.
 */
export async function devInstall(flavor: string = 'civ', opts: DevOpts = {}): Promise<void> {
  const { root } = resolveProject();
  const port = resolveDevPort(root, opts.port);
  console.log(`\n  atak-reactive dev install (flavor: ${flavor}, port: ${port})\n`);

  const serial = preflightDevice();
  log(`Preflight OK — device ${serial}`);

  buildAndInstall(root, flavor, port);
  logDone(`Installed. Run "atak-reactive dev serve" to start the dev server.`);
}

/**
 * `dev serve` — tunnel and dev server only, no Gradle and no install.
 *
 * The tunnel is why this exists: `dev` removes it on exit, so restarting Vite by
 * hand leaves a working server the device cannot reach.
 */
export async function devServe(opts: DevOpts = {}): Promise<void> {
  const { root, webDir } = resolveProject();
  const port = resolveDevPort(root, opts.port);
  console.log(`\n  atak-reactive dev serve (port: ${port})\n`);

  const serial = preflightDevice();
  const held = await preflightPort(port);
  log(`Preflight OK — device ${serial}, port ${port} reserved`);
  log(`Assumes the installed APK was built for port ${port} — run "dev" if it changed.`);

  await runServer(webDir, port, held);
}
