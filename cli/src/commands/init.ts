import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } from 'fs';
import { join, basename } from 'path';
import {
  CLI_VERSION,
  SUPPORTED_ATAK_VERSIONS,
  findProjectRoot,
  fileContains,
  appendIfMissing,
  detectAtakVersion,
  detectInstallType,
  getAarVersion,
  addAarDependency,
  removeSourceInstall,
  findMapComponents,
  deriveIntentAction,
  injectReactiveRegistration,
  exec,
  log,
  logStep,
  logDone,
  logError,
} from '../utils.js';

export function init(opts: { embedded?: boolean; dryRun?: boolean } = {}): void {
  if (opts.dryRun) {
    console.log('\n  atak-reactive init (dry run)\n');
  } else {
    console.log('\n  atak-reactive init\n');
  }

  // 1. Find project root
  const root = findProjectRoot();
  if (!root) {
    logError('Could not find settings.gradle. Run this from an ATAK plugin project root.');
    process.exit(1);
  }
  log(`Project root: ${root}`);

  const appDir = join(root, 'app');
  const buildGradle = join(appDir, 'build.gradle');
  const proguardFile = join(appDir, 'proguard-gradle.txt');

  if (!existsSync(buildGradle)) {
    logError(`${buildGradle} not found. Is this an ATAK plugin project?`);
    process.exit(1);
  }

  // 2. Detect ATAK version
  const atakVersion = detectAtakVersion(buildGradle);
  if (atakVersion) {
    log(`Detected ATAK version: ${atakVersion}`);
  } else {
    log('Warning: Could not detect ATAK_VERSION from build.gradle');
  }

  if (atakVersion && !SUPPORTED_ATAK_VERSIONS.includes(atakVersion)) {
    logError(
      `ATAK ${atakVersion} is not supported. Supported versions: ${SUPPORTED_ATAK_VERSIONS.join(', ')}`,
    );
    process.exit(1);
  }

  const effectiveAtakVersion = atakVersion ?? '5.6.0';

  // 3. Detect existing installation
  const installType = detectInstallType(appDir, buildGradle);
  const installedVersion = installType === 'aar' ? getAarVersion(buildGradle) : null;

  // Already up to date (AAR install with matching version)
  if (installType === 'aar' && installedVersion === CLI_VERSION) {
    log(`Already up to date (${CLI_VERSION}).`);
    return;
  }

  // --- Update path: existing AAR install, different version ---
  if (installType === 'aar') {
    log(`Existing AAR installation detected (${installedVersion}).`);
    log(`Latest available: ${CLI_VERSION}`);

    if (opts.dryRun) {
      log('');
      log('Would update:');
      log(`  compileOnly dependency → ${CLI_VERSION}`);
      log(`  @atak-reactive/sdk → ^${CLI_VERSION} in web/package.json`);
      log('');
      log('Run without --dry-run to apply.');
      return;
    }

    // 1. Bump AAR version
    logStep('Updating AAR dependency...');
    const result = addAarDependency(buildGradle, effectiveAtakVersion, CLI_VERSION);
    log(`${installedVersion} → ${CLI_VERSION} (${result})`);

    // 2. Update SDK version in web/package.json
    logStep('Updating SDK dependency...');
    updateWebPackageJson(root);

    // 3. npm install
    logStep('Installing dependencies...');
    const webDir = join(root, 'web');
    const { ok } = exec('npm install', webDir);
    log(ok ? 'npm install complete' : 'Warning: npm install failed');

    logDone(`Updated to ${CLI_VERSION}. Run 'npx @atak-reactive/cli dev' to test.`);
    return;
  }

  // --- Migration path: source-copy install → AAR ---
  if (installType === 'source') {
    log('Existing source-copy installation detected.');
    log('Migrating to AAR dependency...');

    if (opts.dryRun) {
      log('');
      log('Would migrate:');
      log('  1. Remove com/atakmap/android/reactive/ (source files)');
      log(`  2. Add compileOnly "dev.atakreactive:bridge-${effectiveAtakVersion}:${CLI_VERSION}"`);
      log(`  3. Update @atak-reactive/sdk → ^${CLI_VERSION} in web/package.json`);
      log('');
      log('Run without --dry-run to apply.');
      return;
    }

    // 1. Remove source files
    logStep('Removing source-copy files...');
    const removed = removeSourceInstall(appDir, root);
    log(`Removed ${removed} files`);

    // 2. Add AAR dependency
    logStep('Adding AAR dependency...');
    addAarDependency(buildGradle, effectiveAtakVersion, CLI_VERSION);
    log(`Added compileOnly "dev.atakreactive:bridge-${effectiveAtakVersion}:${CLI_VERSION}"`);

    // 3. Update SDK version in web/package.json
    logStep('Updating SDK dependency...');
    updateWebPackageJson(root);

    // 4. npm install
    logStep('Installing dependencies...');
    const webDir = join(root, 'web');
    const { ok } = exec('npm install', webDir);
    log(ok ? 'npm install complete' : 'Warning: npm install failed');

    logDone(`Migrated to AAR. Your MapComponent and custom bridges are unchanged.`);
    return;
  }

  // --- Fresh install path ---

  // 4. Add AAR dependency
  logStep('Adding AAR dependency...');
  addAarDependency(buildGradle, effectiveAtakVersion, CLI_VERSION);
  log(`Added compileOnly "dev.atakreactive:bridge-${effectiveAtakVersion}:${CLI_VERSION}"`);

  // 5. Patch build.gradle — webkit dependency
  logStep('Patching app/build.gradle...');

  const gradleRaw = readFileSync(buildGradle, 'utf-8');
  if (gradleRaw.includes('androidx.webkit')) {
    log('androidx.webkit dependency already present');
  } else {
    const depsRegex = /dependencies\s*\{[^}]*implementation\s+fileTree/;
    const depsMatch = depsRegex.exec(gradleRaw);
    if (depsMatch) {
      const depsIdx = gradleRaw.indexOf('dependencies', depsMatch.index);
      const braceIdx = gradleRaw.indexOf('{', depsIdx);
      const webkitLine = "\n    implementation 'androidx.webkit:webkit:1.12.1'";
      const patched = gradleRaw.slice(0, braceIdx + 1) + webkitLine + gradleRaw.slice(braceIdx + 1);
      writeFileSync(buildGradle, patched);
      log('Added androidx.webkit dependency');
    } else {
      log('Warning: Could not find project dependencies block — add manually:');
      log("  implementation 'androidx.webkit:webkit:1.12.1'");
    }
  }

  // 6. Patch build.gradle — assets srcDir
  const assetsSrcDir = '            assets.srcDirs += ["${rootDir}/web/dist-assets"]';
  const gradleContent = readFileSync(buildGradle, 'utf-8');
  if (gradleContent.includes('dist-assets')) {
    log('assets.srcDirs already configured');
  } else {
    const mainBlockMatch = gradleContent.match(/sourceSets\s*\{[\s\S]*?main\s*\{/);
    if (mainBlockMatch) {
      const mainIdx = gradleContent.indexOf(mainBlockMatch[0]!);
      const afterMain = mainIdx + mainBlockMatch[0]!.length;
      let braceDepth = 1;
      let insertIdx = afterMain;
      for (let i = afterMain; i < gradleContent.length; i++) {
        if (gradleContent[i] === '{') braceDepth++;
        if (gradleContent[i] === '}') braceDepth--;
        if (braceDepth === 0) {
          insertIdx = i;
          break;
        }
      }
      const patched = gradleContent.slice(0, insertIdx) +
        '\n' + assetsSrcDir + '\n        ' +
        gradleContent.slice(insertIdx);
      writeFileSync(buildGradle, patched);
      log('Added assets.srcDirs for web build output');
    } else {
      log('Warning: Could not find sourceSets.main block — add manually:');
      log(`  ${assetsSrcDir}`);
    }
  }

  // 7. Patch build.gradle — auto-build web assets before APK
  const gradleAfterAssets = readFileSync(buildGradle, 'utf-8');
  if (gradleAfterAssets.includes('buildWebAssets')) {
    log('Gradle web build task already present');
  } else {
    const webBuildTask = `
// atak-reactive: build web assets before assembling APK
task buildWebAssets(type: Exec) {
    workingDir "\${rootDir}/web"
    commandLine 'npm', 'run', 'build'
}
preBuild.dependsOn buildWebAssets
`;
    writeFileSync(buildGradle, gradleAfterAssets.trimEnd() + '\n' + webBuildTask);
    log('Added Gradle task to auto-build web assets before APK');
  }

  // 8. Patch proguard
  logStep('Patching proguard-gradle.txt...');
  if (existsSync(proguardFile)) {
    const snippet = readFileSync(
      join(__dirname, 'templates', 'proguard-snippet.txt'),
      'utf-8',
    );
    const added = appendIfMissing(proguardFile, '@android.webkit.JavascriptInterface', snippet);
    log(added ? 'Added JavascriptInterface keep rule' : 'Proguard rule already present');
  } else {
    log('Warning: proguard-gradle.txt not found, skipping');
  }

  // 9. Scaffold web/ folder
  const webDir = join(root, 'web');
  if (existsSync(join(webDir, 'package.json'))) {
    log('web/ folder already exists, skipping scaffold');
  } else {
    logStep('Creating web/ folder...');
    const webTemplates = join(__dirname, 'templates', 'web');

    mkdirSync(join(webDir, 'src'), { recursive: true });

    for (const file of ['tsconfig.json', 'vite.config.ts', 'index.html']) {
      cpSync(join(webTemplates, file), join(webDir, file));
    }
    cpSync(join(webTemplates, 'src', 'main.tsx'), join(webDir, 'src', 'main.tsx'));
    cpSync(join(webTemplates, 'src', 'App.tsx'), join(webDir, 'src', 'App.tsx'));

    const projectName = basename(root);
    const pkgTemplate = readFileSync(join(webTemplates, 'package.json.tmpl'), 'utf-8');
    writeFileSync(
      join(webDir, 'package.json'),
      pkgTemplate
        .replace(/\{\{name\}\}/g, projectName)
        .replace(/\{\{version\}\}/g, `^${CLI_VERSION}`),
    );

    log('Created web/ with React + Vite + TypeScript');
  }

  // 10. Update .gitignore
  logStep('Updating .gitignore...');
  const gitignore = join(root, '.gitignore');
  if (existsSync(gitignore)) {
    appendIfMissing(gitignore, 'dist-assets', '\n# atak-reactive build output\ndist-assets/\n');
  } else {
    writeFileSync(gitignore, '# atak-reactive build output\ndist-assets/\n');
  }
  log('.gitignore updated');

  // 11. Install npm deps
  logStep('Installing web dependencies...');
  const { ok, output } = exec('npm install', webDir);
  if (ok) {
    log('npm install complete');
  } else {
    log('Warning: npm install failed — run it manually in web/');
    log(output);
  }

  // 12. Auto-register ReactiveDropDown in MapComponent (skip for --embedded)
  let intentAction: string | null = null;

  if (opts.embedded) {
    logStep('Skipping ReactiveDropDown registration (--embedded mode)');
    log('');
    log('  Add ReactiveWebView to your existing DropDownReceiver:');
    log('');
    log('    import com.atakmap.android.reactive.ReactiveWebView;');
    log('');
    log('    ReactiveWebView reactView = new ReactiveWebView(mapView, ctx, "web/index.html");');
    log('    myContainer.addView(reactView);');
    log('    reactView.onResume();');
  } else {
    logStep('Registering ReactiveDropDown...');

    const mapComponents = findMapComponents(appDir);

    if (mapComponents.length === 0) {
      log('Warning: No MapComponent with registerDropDownReceiver found.');
      log('');
      log('Add this to your MapComponent.onCreate():');
      log('');
      log('  import com.atakmap.android.reactive.ReactiveDropDown;');
      log('');
      log('  ReactiveDropDown reactScreen = new ReactiveDropDown(view, context, "web/index.html");');
      log('  DocumentedIntentFilter reactFilter = new DocumentedIntentFilter();');
      log('  reactFilter.addAction("com.yourplugin.SHOW_REACT",');
      log('          "React screen powered by atak-reactive");');
      log('  this.registerDropDownReceiver(reactScreen, reactFilter);');
    } else if (mapComponents.length === 1) {
      const comp = mapComponents[0]!;
      intentAction = deriveIntentAction(comp.packageName);
      const result = injectReactiveRegistration(comp.filePath, intentAction);

      switch (result) {
        case 'injected':
          log(`Registered in ${comp.relativePath}`);
          log(`  Class: ${comp.className}`);
          log(`  Intent action: ${intentAction}`);
          log('');
          log('  Added:');
          log('    import com.atakmap.android.reactive.ReactiveDropDown;');
          log(`    ReactiveDropDown reactScreen = new ReactiveDropDown(view, context, "web/index.html");`);
          log(`    reactFilter.addAction("${intentAction}", ...);`);
          log(`    this.registerDropDownReceiver(reactScreen, reactFilter);`);
          break;
        case 'already_exists':
          log(`ReactiveDropDown already registered in ${comp.relativePath}`);
          break;
        case 'failed':
          log(`Warning: Could not find registerDropDownReceiver call in ${comp.relativePath}`);
          log('Add the registration manually (see README).');
          break;
      }
    } else {
      log(`Found ${mapComponents.length} MapComponents:`);
      for (const comp of mapComponents) {
        log(`  - ${comp.relativePath} (${comp.className})`);
      }
      log('');
      log('Multiple MapComponents found — skipping auto-registration.');
      log('Add this to the one you want:');
      log('');
      log('  import com.atakmap.android.reactive.ReactiveDropDown;');
      log('');
      log('  ReactiveDropDown reactScreen = new ReactiveDropDown(view, context, "web/index.html");');
      log('  DocumentedIntentFilter reactFilter = new DocumentedIntentFilter();');
      log('  reactFilter.addAction("com.yourplugin.SHOW_REACT",');
      log('          "React screen powered by atak-reactive");');
      log('  this.registerDropDownReceiver(reactScreen, reactFilter);');
    }

    if (mapComponents.length === 1) {
      intentAction = deriveIntentAction(mapComponents[0]!.packageName);
    }
  }

  console.log('');
  if (opts.embedded) {
    logDone('atak-reactive initialized (embedded mode).\n' +
      '\n    Next steps:\n' +
      '    1. Add ReactiveWebView to your existing DropDownReceiver\n' +
      '    2. npx @atak-reactive/cli dev       (start dev server)\n' +
      '    3. Edit web/src/App.tsx              (hot-reload in ATAK)\n');
  } else {
    logDone('atak-reactive initialized.\n' +
      '\n    Next steps:\n' +
      '    1. npx @atak-reactive/cli dev       (start dev server)\n' +
      '    2. Edit web/src/App.tsx              (hot-reload in ATAK)\n' +
      (intentAction
        ? `    3. Trigger: adb shell am broadcast -a ${intentAction}\n`
        : '    3. Trigger the React screen from your plugin UI\n'));
  }
}

function updateWebPackageJson(root: string): void {
  const webPkgPath = join(root, 'web', 'package.json');
  if (existsSync(webPkgPath)) {
    const webPkg = JSON.parse(readFileSync(webPkgPath, 'utf-8'));
    const oldSdk = webPkg.dependencies?.['@atak-reactive/sdk'] ?? 'unknown';
    webPkg.dependencies['@atak-reactive/sdk'] = `^${CLI_VERSION}`;
    webPkg.devDependencies['@atak-reactive/cli'] = `^${CLI_VERSION}`;
    writeFileSync(webPkgPath, JSON.stringify(webPkg, null, 2) + '\n');
    log(`${oldSdk} → ^${CLI_VERSION}`);
  }
}
