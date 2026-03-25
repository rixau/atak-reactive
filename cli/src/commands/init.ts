import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } from 'fs';
import { join, basename } from 'path';
import {
  findProjectRoot,
  fileContains,
  appendIfMissing,
  patchGradleBlock,
  detectAtakVersion,
  resolveTemplateVersion,
  listSupportedVersions,
  findMapComponents,
  deriveIntentAction,
  injectReactiveRegistration,
  exec,
  log,
  logStep,
  logDone,
  logError,
} from '../utils.js';

export function init(): void {
  console.log('\n  atak-reactive init\n');

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

  // 2. Detect ATAK version and resolve templates
  const atakVersion = detectAtakVersion(buildGradle);
  if (atakVersion) {
    log(`Detected ATAK version: ${atakVersion}`);
  } else {
    log('Warning: Could not detect ATAK_VERSION from build.gradle');
  }

  const templatesDir = join(__dirname, 'templates');
  const templateVersion = atakVersion
    ? resolveTemplateVersion(templatesDir, atakVersion)
    : null;

  if (atakVersion && !templateVersion) {
    const supported = listSupportedVersions(templatesDir);
    logError(
      `No templates for ATAK ${atakVersion}. Supported versions: ${supported.join(', ')}`,
    );
    process.exit(1);
  }

  const javaTemplatesDir = templateVersion
    ? join(templatesDir, templateVersion, 'java', 'reactive')
    : null;

  if (!javaTemplatesDir || !existsSync(javaTemplatesDir)) {
    const supported = listSupportedVersions(templatesDir);
    logError(
      `Java templates not found. Supported versions: ${supported.join(', ')}`,
    );
    process.exit(1);
  }

  log(`Using templates for ATAK ${templateVersion}`);

  // 3. Copy Java source
  const reactiveDir = join(appDir, 'src/main/java/com/atakmap/android/reactive');
  const checkFile = join(reactiveDir, 'ReactiveDropDown.java');

  if (existsSync(checkFile)) {
    log('Java source already exists, skipping copy');
  } else {
    logStep('Copying Java library source...');
    cpSync(javaTemplatesDir, reactiveDir, { recursive: true });
    log(`Copied reactive/ (ATAK ${templateVersion}) to app/src/main/java/com/atakmap/android/reactive/`);
  }

  // 3. Patch build.gradle — webkit dependency
  logStep('Patching app/build.gradle...');

  const gradleRaw = readFileSync(buildGradle, 'utf-8');
  if (gradleRaw.includes('androidx.webkit')) {
    log('androidx.webkit dependency already present');
  } else {
    // Find the project-level dependencies block (has "implementation fileTree")
    // not the buildscript dependencies block (has "classpath")
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

  // 4. Patch build.gradle — assets srcDir
  const assetsSrcDir = '            assets.srcDirs += ["${rootDir}/web/dist-assets"]';
  const gradleContent = readFileSync(buildGradle, 'utf-8');
  if (gradleContent.includes('dist-assets')) {
    log('assets.srcDirs already configured');
  } else {
    // Find sourceSets { main { and add after the versionName line or closing of that block
    const mainBlockMatch = gradleContent.match(/sourceSets\s*\{[\s\S]*?main\s*\{/);
    if (mainBlockMatch) {
      const mainIdx = gradleContent.indexOf(mainBlockMatch[0]!);
      const afterMain = mainIdx + mainBlockMatch[0]!.length;
      // Find the closing brace of the main block — insert before it
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

  // 4b. Patch build.gradle — auto-build web assets before APK
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
    // Append at end of file
    writeFileSync(buildGradle, gradleAfterAssets.trimEnd() + '\n' + webBuildTask);
    log('Added Gradle task to auto-build web assets before APK');
  }

  // 5. Patch proguard
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

  // 6. Scaffold web/ folder
  const webDir = join(root, 'web');
  if (existsSync(join(webDir, 'package.json'))) {
    log('web/ folder already exists, skipping scaffold');
  } else {
    logStep('Creating web/ folder...');
    const webTemplates = join(__dirname, 'templates', 'web');

    mkdirSync(join(webDir, 'src'), { recursive: true });

    // Copy static templates
    for (const file of ['tsconfig.json', 'vite.config.ts', 'index.html']) {
      cpSync(join(webTemplates, file), join(webDir, file));
    }
    cpSync(join(webTemplates, 'src', 'main.tsx'), join(webDir, 'src', 'main.tsx'));
    cpSync(join(webTemplates, 'src', 'App.tsx'), join(webDir, 'src', 'App.tsx'));

    // Generate package.json from template
    const projectName = basename(root);
    const pkgTemplate = readFileSync(join(webTemplates, 'package.json.tmpl'), 'utf-8');
    writeFileSync(join(webDir, 'package.json'), pkgTemplate.replace(/\{\{name\}\}/g, projectName));

    log('Created web/ with React + Vite + TypeScript');
  }

  // 7. Update .gitignore
  logStep('Updating .gitignore...');
  const gitignore = join(root, '.gitignore');
  if (existsSync(gitignore)) {
    appendIfMissing(gitignore, 'dist-assets', '\n# atak-reactive build output\ndist-assets/\n');
  } else {
    writeFileSync(gitignore, '# atak-reactive build output\ndist-assets/\n');
  }
  log('.gitignore updated');

  // 8. Install npm deps
  logStep('Installing web dependencies...');
  const { ok, output } = exec('npm install', webDir);
  if (ok) {
    log('npm install complete');
  } else {
    log('Warning: npm install failed — run it manually in web/');
    log(output);
  }

  // 9. Auto-register ReactiveDropDown in MapComponent
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
    const intentAction = deriveIntentAction(comp.packageName);
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

  // Summary
  const intentAction = mapComponents.length === 1
    ? deriveIntentAction(mapComponents[0]!.packageName)
    : null;

  console.log('');
  logDone('atak-reactive initialized.\n' +
    '\n    Next steps:\n' +
    '    1. npx @atak-reactive/cli dev       (start dev server)\n' +
    '    2. Edit web/src/App.tsx              (hot-reload in ATAK)\n' +
    (intentAction
      ? `    3. Trigger: adb shell am broadcast -a ${intentAction}\n`
      : '    3. Trigger the React screen from your plugin UI\n'));
}
