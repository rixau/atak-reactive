import { existsSync } from 'fs';
import { join } from 'path';
import { execSync, spawn } from 'child_process';
import { findProjectRoot, log, logError } from '../utils.js';

export function dev(): void {
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

  // adb reverse
  console.log('\n  atak-reactive dev\n');
  try {
    execSync('adb reverse tcp:5173 tcp:5173', { stdio: 'pipe' });
    log('adb reverse tcp:5173 — port forwarding active');
  } catch {
    log('Warning: adb reverse failed — is a device/emulator connected?');
    log('Hot-reload will work in browser but not on device until you run:');
    log('  adb reverse tcp:5173 tcp:5173');
  }

  // Start vite
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
    // Also kill anything left on port 5173
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
