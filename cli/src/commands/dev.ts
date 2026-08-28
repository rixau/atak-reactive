import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync, spawn } from 'child_process';
import {
  findProjectRoot,
  log,
  logError,
  resolveDevPort,
  newestApk,
} from '../utils.js';
import { preflight, releasePort, openTunnel, closeTunnel , killProcessTree, devServerSpawnOpts }
  from './preflight.js';

export async function dev(
  flavor: string = 'civ',
  opts: { port?: number } = {},
): Promise<void> {
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
  console.log(`\n  atak-reactive dev (flavor: ${flavor}, port: ${port})\n`);

  const held = await preflight(port);

  // From here on the port stays held until just before Vite starts.
  let viteStarted = false;
  const abort = async (msg: string): Promise<never> => {
    await releasePort(held);
    logError(msg);
    process.exit(1);
  };

  // Step 1: Build debug APK (skip web build — dev mode uses the Vite dev server)
  const capFlavor = flavor.charAt(0).toUpperCase() + flavor.slice(1);
  log(`Building debug APK (${capFlavor}Debug)...`);
  try {
    const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
    const buildGradle = join(root, 'app', 'build.gradle');
    const gradleSrc = existsSync(buildGradle) ? readFileSync(buildGradle, 'utf-8') : '';
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
    await abort('Gradle build failed.');
  }

  // Step 2: Install APK — newest by mtime; filenames embed a git sha so stale
  // builds accumulate and readdir order would happily install an old one.
  log('Installing APK...');
  const apkDir = join(root, 'app', 'build', 'outputs', 'apk', flavor, 'debug');
  const apk = newestApk(apkDir);
  if (!apk) {
    await abort(`No APK found in ${apkDir}`);
  }
  try {
    execSync(`adb install -r "${join(apkDir, apk!)}"`, { stdio: 'inherit' });
    log(`APK installed (${apk}).`);
  } catch {
    await abort('APK install failed.');
  }

  // Step 3: ADB reverse tunnel
  await openTunnel(port, () => releasePort(held));

  // Step 4: Hand the port to Vite. --strictPort so the millisecond gap between
  // releasing our hold and Vite binding fails loudly instead of drifting.
  await releasePort(held);

  log('Starting Vite dev server...\n');
  const vite = spawn(
    'npx',
    ['vite', '--host', '--port', String(port), '--strictPort'],
    {
      cwd: webDir,
      ...devServerSpawnOpts,
      // Scoped to this process, not written to a file: a persisted .env.local would
      // outlive the run and silently override local.properties on the next
      // plain `npm run dev`.
      env: { ...process.env, ATAK_DEV_PORT: String(port) },
    },
  );
  viteStarted = true;

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    killProcessTree(vite);
    // Deliberately NOT `kill $(lsof -t -i :port)` — that killed whatever held the
    // port, including other developers' servers, and is POSIX-only besides.
    // vite.kill above already terminates the process we started.
    closeTunnel(port);
  };

  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });
  process.on('exit', cleanup);

  vite.on('exit', (code) => {
    cleanup();
    if (code && viteStarted) {
      logError(`Vite exited (code ${code}). Pass --port <n> if ${port} was taken.`);
    }
    process.exit(code ?? 0);
  });
}
