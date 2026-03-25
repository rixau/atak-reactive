import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { execSync, spawn } from 'child_process';
import { findProjectRoot, log, logError } from '../utils.js';

export function dev(flavor: string = 'civ'): void {
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

  console.log(`\n  atak-reactive dev (flavor: ${flavor})\n`);

  // Step 1: Build web assets
  log('Building web assets...');
  try {
    execSync('npm run build', { cwd: webDir, stdio: 'inherit' });
  } catch {
    logError('Web build failed.');
    process.exit(1);
  }

  // Step 2: Build debug APK
  const capFlavor = flavor.charAt(0).toUpperCase() + flavor.slice(1);
  log(`Building debug APK (${capFlavor}Debug)...`);
  try {
    const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
    execSync(`${gradlew} assemble${capFlavor}Debug`, { cwd: root, stdio: 'inherit' });
  } catch {
    logError('Gradle build failed.');
    process.exit(1);
  }

  // Step 3: Install APK
  log('Installing APK...');
  try {
    const apkDir = join(root, 'app', 'build', 'outputs', 'apk', flavor, 'debug');
    if (existsSync(apkDir)) {
      const apks = readdirSync(apkDir).filter(f => f.endsWith('.apk'));
      if (apks.length > 0) {
        execSync(`adb install -r "${join(apkDir, apks[0])}"`, { stdio: 'inherit' });
        log('APK installed.');
      } else {
        log('Warning: No APK found in build output.');
      }
    }
  } catch {
    log('Warning: APK install failed — is a device/emulator connected?');
  }

  // Step 4: ADB port forward
  try {
    execSync('adb reverse tcp:5173 tcp:5173', { stdio: 'pipe' });
    log('adb reverse tcp:5173 — port forwarding active');
  } catch {
    log('Warning: adb reverse failed — is a device/emulator connected?');
    log('Hot-reload will work in browser but not on device until you run:');
    log('  adb reverse tcp:5173 tcp:5173');
  }

  // Step 5: Start Vite dev server
  log('Starting Vite dev server...\n');
  const vite = spawn('npx', ['vite', '--host', '--port', '5173', '--strictPort'], {
    cwd: webDir,
    stdio: 'inherit',
    shell: true,
    detached: false,
  });

  // Ensure Vite is killed on exit
  const cleanup = () => {
    try {
      vite.kill('SIGTERM');
    } catch {
      // Already dead
    }
    try {
      execSync('kill $(lsof -t -i :5173) 2>/dev/null', { stdio: 'pipe' });
    } catch {
      // Nothing on port
    }
    try {
      execSync('adb reverse --remove tcp:5173', { stdio: 'pipe' });
    } catch {
      // Ignore
    }
  };

  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });
  process.on('exit', cleanup);

  vite.on('exit', (code) => {
    cleanup();
    process.exit(code ?? 0);
  });
}
