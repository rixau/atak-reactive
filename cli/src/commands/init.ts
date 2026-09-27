import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } from 'fs';
import { join, basename } from 'path';
import {
  CLI_VERSION,
  SUPPORTED_ATAK_VERSIONS,
  findProjectRoot,
  appendIfMissing,
  detectAtakVersion,
  detectInstallType,
  getAarVersion,
  addAarDependency,
  removeSourceInstall,
  findMapComponents,
  deriveIntentAction,
  readPluginImpl,
  isTemplateOwned,
  TEMPLATE_PACKAGE,
  injectReactiveRegistration,
  exec,
  log,
  logStep,
  logDone,
  logError,
} from '../utils.js';

/** Density buckets the icon template ships, see scripts/generate-icons.py. */
const ICON_DENSITIES = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];

/**
 * Warn when the plugin still hands ATAK the template's implementation class.
 *
 * ATAK's AtakPluginRegistry de-duplicates IPlugin extensions by implementation
 * class name across every installed plugin, and AtakBroadcast actions are
 * process-wide within ATAK. A project still on the template's package therefore
 * collides with every other unrenamed template-derived plugin on the same
 * device: one of the two is silently skipped — it just reads "Not loaded" in
 * ATAK's plugin manager, with no error — and their intent actions cross-fire.
 *
 * `init` deliberately only reports this. Renaming someone's Java package
 * rewrites their source tree, their plugin.xml and their manifest, which is far
 * beyond what adding a React screen to a plugin should do.
 *
 * Returns the lines so the dry-run can report the same thing it would print.
 */
function templatePackageWarning(appDir: string, embedded: boolean): string[] {
  if (!isTemplateOwned(readPluginImpl(appDir))) return [];
  const lines = [
    `Warning: this plugin still declares the ATAK template's class in plugin.xml,`,
    `  under ${TEMPLATE_PACKAGE}.`,
    '',
    '  ATAK identifies a plugin by its implementation class name, so two plugins',
    '  built from the template collide on one device: the second to be scanned is',
    '  silently skipped and shows as "Not loaded", with nothing logged as an error.',
  ];
  if (!embedded) {
    lines.push(
      '  Intent actions are derived from that package too, and ATAK\'s broadcast',
      '  bus is process-wide, so those collide as well.',
    );
  }
  lines.push(
    '',
    '  Rename the Java package before you publish, and update the impl= in',
    '  app/src/main/assets/plugin.xml to match.',
  );
  return lines;
}

/**
 * Drop `ic_reactive_tool` into the host plugin's res/ so it can brand its
 * side-menu entry with the atak-reactive mark if it wants to.
 *
 * Deliberately additive: this writes one new drawable name and nothing else. A
 * host plugin owns its own identity, so we never touch its `ic_launcher` or its
 * manifest, and we skip any density it has already filled in rather than
 * overwriting art someone may have replaced on purpose.
 */
function copyToolIcon(appDir: string): 'copied' | 'present' | 'no-res' {
  const resDir = join(appDir, 'src', 'main', 'res');
  if (!existsSync(resDir)) return 'no-res';

  const templates = join(__dirname, 'templates', 'res');
  let copied = 0;
  for (const density of ICON_DENSITIES) {
    const dest = join(resDir, `drawable-${density}`, 'ic_reactive_tool.png');
    if (existsSync(dest)) continue;
    mkdirSync(join(resDir, `drawable-${density}`), { recursive: true });
    cpSync(join(templates, `drawable-${density}`, 'ic_reactive_tool.png'), dest);
    copied++;
  }
  return copied > 0 ? 'copied' : 'present';
}

/**
 * Ensure the project's .gitignore covers what we generate — and, importantly,
 * `local.properties`, which holds tak.gov Artifactory credentials
 * (takrepo.user / takrepo.password). The ATAK plugin template ships without a
 * .gitignore at all, so without this a `git add .` publishes those credentials.
 *
 * Runs on EVERY init (including "already up to date"), because existing projects
 * scaffolded by older versions still need the protection.
 */
function ensureGitignore(root: string): void {
  logStep('Updating .gitignore...');
  const gitignore = join(root, '.gitignore');
  if (!existsSync(gitignore)) {
    writeFileSync(gitignore, '');
  }
  const added: string[] = [];
  if (appendIfMissing(gitignore, 'dist-assets', '\n# atak-reactive build output\ndist-assets/\n')) {
    added.push('dist-assets/');
  }
  if (appendIfMissing(gitignore, 'node_modules', '\n# npm\nnode_modules/\n')) {
    added.push('node_modules/');
  }
  if (
    existsSync(join(root, 'local.properties')) ||
    existsSync(join(root, 'template.local.properties'))
  ) {
    if (
      appendIfMissing(
        gitignore,
        'local.properties',
        '\n# local machine config — contains SDK paths and tak.gov credentials\nlocal.properties\n',
      )
    ) {
      added.push('local.properties');
    }
  }
  log(added.length ? `.gitignore updated (${added.join(', ')})` : '.gitignore already up to date');
}


/**
 * Gradle loads gradle.properties into project properties, never local.properties —
 * so `project.properties['devServerPort']` is always null and the resValue silently
 * falls back to its default. Read the file explicitly.
 */
function localPropertyResValue(resName: string, key: string, fallback: string): string {
  return (
    `\n            resValue "string", "${resName}", {` +
    `\n                def v = project.findProperty('${key}')` +
    `\n                if (v == null) {` +
    `\n                    def f = rootProject.file('local.properties')` +
    `\n                    if (f.exists()) {` +
    `\n                        def props = new Properties()` +
    `\n                        f.withInputStream { props.load(it) }` +
    `\n                        v = props.getProperty('${key}')` +
    `\n                    }` +
    `\n                }` +
    `\n                return v ?: '${fallback}'` +
    `\n            }()`
  );
}


/**
 * Patches that must run on EVERY init, including the early-return paths for an
 * existing AAR install. All are idempotent ("already present" guards). A project
 * scaffolded before these settings existed can only acquire them here; otherwise
 * init reports "Already on <version>" and changes nothing.
 */
function applyAlwaysOnPatches(
  root: string,
  buildGradle: string,
  opts: { dryRun?: boolean },
): string[] {
  // Runs ahead of every early return, so under --dry-run nothing here may touch
  // disk. Each branch describes what it would do; the caller prints it.
  const pending: string[] = [];
  if (!existsSync(buildGradle)) return pending;

  // 7. Patch build.gradle — dev server host for wireless debugging
  const gradleForDevHost = readFileSync(buildGradle, 'utf-8');
  if (gradleForDevHost.includes('atak_reactive_dev_host')) {
    if (!opts.dryRun) log('Dev server host resValue already present');
  } else {
    const debugBlockMatch = /buildTypes\s*\{[\s\S]*?debug\s*\{/.exec(gradleForDevHost);
    if (debugBlockMatch) {
      if (opts.dryRun) {
        pending.push('Add dev server host resValue to debug build type');
      } else {
        const insertAfter = debugBlockMatch.index + debugBlockMatch[0].length;
        const devHostLines =
          "\n            // atak-reactive: dev server host (set devServerHost in local.properties for wireless debugging)" +
          localPropertyResValue('atak_reactive_dev_host', 'devServerHost', 'localhost');
        const patched = gradleForDevHost.slice(0, insertAfter) + devHostLines + gradleForDevHost.slice(insertAfter);
        writeFileSync(buildGradle, patched);
        log('Added dev server host resValue to debug build type');
      }
    } else {
      log('Warning: Could not find buildTypes.debug block — add manually if needed for wireless debugging');
    }
  }

  // 7b. Patch build.gradle — dev server port, so each plugin can hold its own
  const gradleForDevPort = readFileSync(buildGradle, 'utf-8');
  if (gradleForDevPort.includes('atak_reactive_dev_port')) {
    if (!opts.dryRun) log('Dev server port resValue already present');
  } else {
    const debugPortMatch = /buildTypes\s*\{[\s\S]*?debug\s*\{/.exec(gradleForDevPort);
    if (debugPortMatch) {
      if (opts.dryRun) {
        pending.push('Add dev server port resValue to debug build type');
      } else {
        const insertAfter = debugPortMatch.index + debugPortMatch[0].length;
        const devPortLines =
          "\n            // atak-reactive: dev server port (set devServerPort in local.properties to run two plugins at once)" +
          localPropertyResValue('atak_reactive_dev_port', 'devServerPort', '5173');
        const patched = gradleForDevPort.slice(0, insertAfter) + devPortLines + gradleForDevPort.slice(insertAfter);
        writeFileSync(buildGradle, patched);
        log('Added dev server port resValue to debug build type');
      }
    } else {
      log('Warning: Could not find buildTypes.debug block — add the dev server port resValue manually');
    }
  }

  const webDir = join(root, 'web');
  if (existsSync(join(webDir, 'package.json'))) {
    // An older vite.config.ts has `port: 5173` and no strictPort, so Vite walks to
    // the next free port while the APK still probes the configured one. Keep a
    // backup, since the developer may have edited it.
    const viteConfig = join(webDir, 'vite.config.ts');
    const templateConfig = join(__dirname, 'templates', 'web', 'vite.config.ts');
    if (existsSync(viteConfig) && existsSync(templateConfig)) {
      const current = readFileSync(viteConfig, 'utf-8');
      if (!current.includes('strictPort')) {
        if (opts.dryRun) {
          pending.push('Update web/vite.config.ts (adds strictPort + devServerPort support)');
        } else {
          writeFileSync(`${viteConfig}.bak`, current);
          cpSync(templateConfig, viteConfig);
          log('Updated web/vite.config.ts for strictPort + devServerPort');
          log('  previous version saved as web/vite.config.ts.bak');
        }
      }
    }
  }

  return pending;
}

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

  // Safety fixes apply on every run, before any early return — projects scaffolded
  // by older versions still need them.
  if (!opts.dryRun) {
    ensureGitignore(root);
  }
  const pendingPatches = applyAlwaysOnPatches(root, buildGradle, opts);

  // Already matches the version this CLI provides.
  // NOTE: this means "matches the running CLI", not "matches npm latest" — a stale
  // npx cache can make an old version look current. index.ts warns when that happens.
  if (installType === 'aar' && installedVersion === CLI_VERSION) {
    log(`Already on ${CLI_VERSION} (the version this CLI installs).`);
    if (opts.dryRun && pendingPatches.length) {
      log('');
      log('Would apply:');
      pendingPatches.forEach((p) => log(`  + ${p}`));
      log('');
      log('Run without --dry-run to apply.');
    }
    return;
  }

  // --- Update path: existing AAR install, different version ---
  if (installType === 'aar') {
    log(`Existing AAR installation detected (${installedVersion}).`);
    log(`This CLI installs: ${CLI_VERSION}`);

    if (opts.dryRun) {
      log('');
      log('Would update:');
      log(`  implementation dependency → ${CLI_VERSION}`);
      log(`  @atak-reactive/sdk → ^${CLI_VERSION} in web/package.json`);
      pendingPatches.forEach((p) => log(`  + ${p}`));
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
      log(`  2. Add implementation "dev.atakreactive:bridge-${effectiveAtakVersion}:${CLI_VERSION}"`);
      log(`  3. Update @atak-reactive/sdk → ^${CLI_VERSION} in web/package.json`);
      pendingPatches.forEach((p, i) => log(`  ${i + 4}. ${p}`));
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
    log(`Added implementation "dev.atakreactive:bridge-${effectiveAtakVersion}:${CLI_VERSION}"`);

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

  if (opts.dryRun) {
    const gradleRaw = readFileSync(buildGradle, 'utf-8');
    const webDir = join(root, 'web');
    const gitignore = join(root, '.gitignore');

    log('');

    // AAR dependency
    if (gradleRaw.includes('dev.atakreactive')) {
      log('  ✓ AAR dependency already present');
    } else {
      log(`  + Add implementation "dev.atakreactive:bridge-${effectiveAtakVersion}:${CLI_VERSION}" to build.gradle`);
    }

    // Webkit
    if (gradleRaw.includes('androidx.webkit')) {
      log('  ✓ androidx.webkit already present');
    } else {
      log("  + Add implementation 'androidx.webkit:webkit:1.12.1' to build.gradle");
    }

    // Assets srcDir
    if (gradleRaw.includes('dist-assets')) {
      log('  ✓ assets.srcDirs already configured');
    } else {
      log('  + Add assets.srcDirs for web build output to build.gradle');
    }

    // applyAlwaysOnPatches reports its own "+" lines, so the two cannot disagree.
    if (gradleRaw.includes('atak_reactive_dev_host')) {
      log('  ✓ Dev server host resValue already present');
    }
    if (gradleRaw.includes('atak_reactive_dev_port')) {
      log('  ✓ Dev server port resValue already present');
    }
    pendingPatches.forEach((p) => log(`  + ${p}`));

    // Web build task
    if (gradleRaw.includes('buildWebAssets')) {
      log('  ✓ Gradle web build task already present');
    } else {
      log('  + Add buildWebAssets Gradle task to build.gradle');
    }

    // Proguard
    if (existsSync(proguardFile)) {
      const proguardContent = readFileSync(proguardFile, 'utf-8');
      if (proguardContent.includes('@android.webkit.JavascriptInterface')) {
        log('  ✓ Proguard keep rule already present');
      } else {
        log('  + Add JavascriptInterface keep rule to proguard-gradle.txt');
      }
    } else {
      log('  ⚠ proguard-gradle.txt not found — will skip');
    }

    // Web folder
    if (existsSync(join(webDir, 'package.json'))) {
      log('  ✓ web/ folder already exists');
    } else {
      log('  + Create web/ folder with React + Vite + TypeScript');
      log('  + Run npm install in web/');
    }

    // Tool icon
    if (existsSync(join(appDir, 'src', 'main', 'res', 'drawable-mdpi', 'ic_reactive_tool.png'))) {
      log('  ✓ ic_reactive_tool already present');
    } else {
      log('  + Add ic_reactive_tool to res/drawable-* (existing icons untouched)');
    }

    // Gitignore
    const gi = existsSync(gitignore) ? readFileSync(gitignore, 'utf-8') : '';
    const wants: Array<[string, boolean]> = [
      ['dist-assets/', gi.includes('dist-assets')],
      ['node_modules/', gi.includes('node_modules')],
      [
        'local.properties',
        gi.includes('local.properties') ||
          !(
            existsSync(join(root, 'local.properties')) ||
            existsSync(join(root, 'template.local.properties'))
          ),
      ],
    ];
    for (const [entry, present] of wants) {
      if (present) log(`  ✓ .gitignore already has ${entry}`);
      else log(`  + Add ${entry} to .gitignore`);
    }

    // MapComponent registration
    if (!opts.embedded) {
      const mapComponents = findMapComponents(appDir);
      if (mapComponents.length === 0) {
        log('  ⚠ No MapComponent found — manual registration needed');
      } else if (mapComponents.length === 1) {
        const comp = mapComponents[0]!;
        const content = readFileSync(comp.filePath, 'utf-8');
        if (content.includes('ReactiveDropDown')) {
          log(`  ✓ ReactiveDropDown already registered in ${comp.relativePath}`);
        } else {
          const action = deriveIntentAction(comp.packageName);
          log(`  + Register ReactiveDropDown in ${comp.relativePath}`);
          log(`    Intent action: ${action}`);
        }
      } else {
        log(`  ⚠ ${mapComponents.length} MapComponents found — manual registration needed`);
      }
    } else {
      log('  - Skipping ReactiveDropDown registration (--embedded mode)');
    }

    // Template package collision
    for (const line of templatePackageWarning(appDir, !!opts.embedded)) {
      log(line ? `  ${line}` : '');
    }

    log('');
    log('Run without --dry-run to apply.');
    return;
  }

  // 4. Add AAR dependency
  logStep('Adding AAR dependency...');
  addAarDependency(buildGradle, effectiveAtakVersion, CLI_VERSION);
  log(`Added implementation "dev.atakreactive:bridge-${effectiveAtakVersion}:${CLI_VERSION}"`);

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

  // 8. Patch build.gradle — auto-build web assets before APK
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

  // 9b. Tool icon for the side-menu entry
  logStep('Adding tool icon...');
  switch (copyToolIcon(appDir)) {
    case 'copied':
      log('Added ic_reactive_tool to res/drawable-*');
      log('  To use it, pass it to your AbstractPluginTool:');
      log('    context.getResources().getDrawable(R.drawable.ic_reactive_tool, null)');
      break;
    case 'present':
      log('ic_reactive_tool already present');
      break;
    case 'no-res':
      log('Warning: app/src/main/res not found, skipping');
      break;
  }

  // 10. .gitignore — already handled up front (applies to every path, see ensureGitignore)

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
    log('');
    log('  Then pause it when hidden and destroy it when you are done with it:');
    log('');
    log('    reactView.onPause();   // tab switched away / panel hidden');
    log('    reactView.destroy();   // onDropDownClose() or disposeImpl()');
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

  const templateWarning = templatePackageWarning(appDir, !!opts.embedded);
  if (templateWarning.length) {
    log('');
    for (const line of templateWarning) log(line);
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
