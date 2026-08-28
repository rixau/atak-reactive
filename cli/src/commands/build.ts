import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { findProjectRoot, log, logError, logDone, newestApk } from '../utils.js';

export function build(flavor: string = 'civ'): void {
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

  const capFlavor = flavor.charAt(0).toUpperCase() + flavor.slice(1);
  console.log(`\n  atak-reactive build (${flavor})\n`);

  // Step 1: Build web assets
  log('Building web assets...');
  try {
    execSync('npm run build', { cwd: webDir, stdio: 'inherit' });
  } catch {
    logError('Web build failed.');
    process.exit(1);
  }

  // Step 2: Build release APK
  log(`Building release APK (${capFlavor}Release)...`);
  try {
    const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
    // init wires `preBuild.dependsOn buildWebAssets`, an Exec task with no declared
    // inputs/outputs — so it always re-runs and would build web/ a second time.
    // Step 1 above already did it, and doing it here reports failures properly.
    const buildGradle = join(root, 'app', 'build.gradle');
    const gradleSrc = existsSync(buildGradle) ? readFileSync(buildGradle, 'utf-8') : '';
    const skipWeb = gradleSrc.includes('buildWebAssets') ? ' -x buildWebAssets' : '';
    execSync(`${gradlew} assemble${capFlavor}Release${skipWeb}`, { cwd: root, stdio: 'inherit' });
  } catch {
    logError('Gradle build failed.');
    process.exit(1);
  }

  // Step 3: Report APK location
  const releaseDir = join(root, 'app', 'build', 'outputs', 'apk', flavor, 'release');
  // Newest by mtime — release filenames embed a git sha, so stale APKs linger and
  // readdir order could hand you the path of an old build to distribute.
  const apk = newestApk(releaseDir);
  if (apk) {
    logDone(`Release APK: ${join(releaseDir, apk)}`);
  } else {
    log(`Warning: no APK found in ${releaseDir}`);
  }
}
