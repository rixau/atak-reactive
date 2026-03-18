import { existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { findProjectRoot, log, logError, logDone } from '../utils.js';

export function build(): void {
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

  console.log('\n  atak-reactive build\n');
  log('Building web assets...');

  try {
    execSync('npm run build', { cwd: webDir, stdio: 'inherit' });
    logDone('Web assets built to web/dist-assets/web/\n    Gradle will bundle them into the APK automatically.');
  } catch {
    logError('Build failed. Check the output above.');
    process.exit(1);
  }
}
