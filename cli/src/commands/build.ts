import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { findProjectRoot, log, logError, logDone, newestApk, listApkEntries } from '../utils.js';

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
  if (!apk) {
    logError(`No APK found in ${releaseDir}`);
    process.exit(1);
  }
  const apkPath = join(releaseDir, apk);

  // In dev the assets come from Vite, so a broken bundling step is invisible until
  // release — where it ships a blank panel. This is the one release failure the
  // library owns, so check it rather than reporting success blindly.
  const entries = listApkEntries(apkPath);
  if (entries === null) {
    log('Warning: could not read the APK to verify web assets.');
  } else if (!entries.includes('assets/web/index.html')) {
    logError(
      `Web assets are missing from the APK — it would show a blank panel.\n` +
      `  Expected assets/web/index.html inside ${apk}\n` +
      `  Check that web/dist-assets was built and that app/build.gradle has:\n` +
      `    assets.srcDirs += ["\${rootDir}/web/dist-assets"]`,
    );
    process.exit(1);
  } else {
    const n = entries.filter((e) => e.startsWith('assets/web/')).length;
    log(`Web assets bundled (${n} file${n === 1 ? '' : 's'}).`);
  }

  logDone(`Release APK: ${apkPath}`);
}
