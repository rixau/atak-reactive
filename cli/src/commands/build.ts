import { existsSync, readdirSync } from 'fs';
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

  // Step 1: Build web assets
  log('Building web assets...');
  try {
    execSync('npm run build', { cwd: webDir, stdio: 'inherit' });
  } catch {
    logError('Web build failed.');
    process.exit(1);
  }

  // Step 2: Build release APK
  log('Building release APK...');
  try {
    const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
    execSync(`${gradlew} assembleCivRelease`, { cwd: root, stdio: 'inherit' });
  } catch {
    logError('Gradle build failed.');
    process.exit(1);
  }

  // Step 3: Report APK location
  const releaseDir = join(root, 'app', 'build', 'outputs', 'apk', 'civ', 'release');
  if (existsSync(releaseDir)) {
    const apks = readdirSync(releaseDir).filter(f => f.endsWith('.apk'));
    if (apks.length > 0) {
      logDone(`Release APK: ${join(releaseDir, apks[0])}`);
    }
  }
}
