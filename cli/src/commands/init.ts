import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } from 'fs';
import { join, basename } from 'path';
import {
  findProjectRoot,
  fileContains,
  appendIfMissing,
  patchGradleBlock,
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

  // 2. Copy Java source
  const reactiveDir = join(appDir, 'src/main/java/com/atakmap/android/reactive');
  const checkFile = join(reactiveDir, 'ReactiveDropDown.java');

  if (existsSync(checkFile)) {
    log('Java source already exists, skipping copy');
  } else {
    logStep('Copying Java library source...');
    const templatesDir = join(__dirname, 'templates', 'java', 'reactive');
    cpSync(templatesDir, reactiveDir, { recursive: true });
    log('Copied reactive/ to app/src/main/java/com/atakmap/android/reactive/');
  }

  // 3. Patch build.gradle — webkit dependency
  logStep('Patching app/build.gradle...');

  const webkitDep = "    implementation 'androidx.webkit:webkit:1.12.1'";
  const webkitPatched = patchGradleBlock(
    buildGradle,
    'dependencies {',
    'androidx.webkit',
    webkitDep,
  );
  if (webkitPatched) {
    log('Added androidx.webkit dependency');
  } else {
    log('androidx.webkit dependency already present');
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

  logDone('atak-reactive initialized. Next steps:\n' +
    '    1. Register a ReactiveDropDown in your MapComponent\n' +
    '    2. Run: cd web && npm run dev\n' +
    '    3. Edit web/src/App.tsx — changes hot-reload in ATAK');
}
