import { existsSync, readFileSync, readdirSync, writeFileSync, appendFileSync, mkdirSync, rmSync } from 'fs';
import { join, dirname, relative } from 'path';
import { execSync, type SpawnSyncReturns } from 'child_process';

declare const __CLI_VERSION__: string;
export const CLI_VERSION: string = typeof __CLI_VERSION__ !== 'undefined' ? __CLI_VERSION__ : '0.0.0';

export function findProjectRoot(startDir: string = process.cwd()): string | null {
  let dir = startDir;
  while (dir !== '/') {
    if (existsSync(join(dir, 'settings.gradle')) || existsSync(join(dir, 'settings.gradle.kts'))) {
      return dir;
    }
    dir = dirname(dir);
  }
  return null;
}

export function fileContains(filePath: string, needle: string): boolean {
  if (!existsSync(filePath)) return false;
  return readFileSync(filePath, 'utf-8').includes(needle);
}

export function appendIfMissing(filePath: string, needle: string, content: string): boolean {
  if (fileContains(filePath, needle)) return false;
  appendFileSync(filePath, content);
  return true;
}

export function patchGradleBlock(
  filePath: string,
  blockMarker: string,
  needle: string,
  insertion: string,
): boolean {
  if (!existsSync(filePath)) return false;
  const content = readFileSync(filePath, 'utf-8');
  if (content.includes(needle)) return false;

  const idx = content.indexOf(blockMarker);
  if (idx === -1) return false;

  // Find the opening brace after the marker
  const braceIdx = content.indexOf('{', idx);
  if (braceIdx === -1) return false;

  const patched = content.slice(0, braceIdx + 1) + '\n' + insertion + content.slice(braceIdx + 1);
  writeFileSync(filePath, patched);
  return true;
}

const VALID_FLAVORS = ['civ', 'mil', 'gov'];

/**
 * Parse the default ATAK flavor from build.gradle content.
 * Returns 'civ' if no valid flavor is detected.
 */
export function parseDefaultFlavor(content: string): string {
  // Pattern 1: supportedFlavors array — [ name : 'civ', default: true ]
  const arrayMatch = content.match(/name\s*:\s*'(\w+)',\s*default:\s*true/);
  if (arrayMatch && VALID_FLAVORS.includes(arrayMatch[1])) return arrayMatch[1];

  // Pattern 2: direct productFlavors — mil { getIsDefault().set(true) }
  const directMatch = content.match(/(\w+)\s*\{\s*getIsDefault\(\)\.set\(true\)/);
  if (directMatch && VALID_FLAVORS.includes(directMatch[1])) return directMatch[1];

  return 'civ';
}

export function exec(cmd: string, cwd?: string): { ok: boolean; output: string } {
  try {
    const output = execSync(cmd, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    });
    return { ok: true, output: output.trim() };
  } catch (e) {
    const err = e as SpawnSyncReturns<string>;
    return { ok: false, output: (err.stderr ?? err.stdout ?? '').trim() };
  }
}

export function log(msg: string): void {
  console.log(`  ${msg}`);
}

export function logStep(msg: string): void {
  console.log(`\n  → ${msg}`);
}

export function logDone(msg: string): void {
  console.log(`\n  Done! ${msg}\n`);
}

export function logError(msg: string): void {
  console.error(`\n  Error: ${msg}\n`);
}

/**
 * Detect ATAK_VERSION from app/build.gradle.
 * Looks for: ext.ATAK_VERSION = '5.6.0'
 */
/**
 * Parse ATAK_VERSION from build.gradle content.
 */
export function parseAtakVersion(content: string): string | null {
  const match = content.match(/ATAK_VERSION\s*=\s*['"](\d+\.\d+\.\d+)['"]/);
  return match?.[1] ?? null;
}

export function detectAtakVersion(buildGradlePath: string): string | null {
  if (!existsSync(buildGradlePath)) return null;
  return parseAtakVersion(readFileSync(buildGradlePath, 'utf-8'));
}

/**
 * Supported ATAK versions (must have a published AAR on Maven Central).
 */
export const SUPPORTED_ATAK_VERSIONS = ['5.4.0', '5.5.0', '5.5.1', '5.6.0'];

/**
 * Recursively find all .java files in a directory.
 */
export function findJavaFiles(dir: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findJavaFiles(fullPath));
    } else if (entry.name.endsWith('.java')) {
      results.push(fullPath);
    }
  }
  return results;
}

export interface MapComponentInfo {
  filePath: string;
  relativePath: string;
  packageName: string;
  className: string;
}

/**
 * Find MapComponent files that contain registerDropDownReceiver.
 */
export function findMapComponents(appDir: string): MapComponentInfo[] {
  const srcDir = join(appDir, 'src/main/java');
  const javaFiles = findJavaFiles(srcDir);
  const results: MapComponentInfo[] = [];

  for (const filePath of javaFiles) {
    // Skip our own library source
    if (filePath.includes('/reactive/')) continue;

    const content = readFileSync(filePath, 'utf-8');
    if (content.includes('registerDropDownReceiver')) {
      const pkgMatch = content.match(/^package\s+([\w.]+);/m);
      const classMatch = content.match(/class\s+(\w+)/);
      if (pkgMatch && classMatch) {
        results.push({
          filePath,
          relativePath: relative(appDir, filePath),
          packageName: pkgMatch[1]!,
          className: classMatch[1]!,
        });
      }
    }
  }

  return results;
}

/**
 * Derive an intent action from the package name.
 */
export function deriveIntentAction(packageName: string): string {
  return `${packageName}.SHOW_REACT`;
}

/**
 * Detect the current install type for atak-reactive.
 */
export function detectInstallType(
  appDir: string,
  buildGradlePath: string,
): 'source' | 'aar' | 'none' {
  const reactiveDir = join(appDir, 'src/main/java/com/atakmap/android/reactive');
  const gradle = existsSync(buildGradlePath)
    ? readFileSync(buildGradlePath, 'utf-8')
    : '';

  if (gradle.includes('dev.atakreactive:bridge-')) return 'aar';
  if (existsSync(reactiveDir)) return 'source';
  return 'none';
}

/**
 * Get the currently installed AAR version from build.gradle.
 */
/**
 * Parse AAR version from build.gradle content.
 */
export function parseAarVersion(content: string): string | null {
  const match = content.match(/dev\.atakreactive:bridge-[\d.]+:([\d.]+)/);
  return match?.[1] ?? null;
}

export function getAarVersion(buildGradlePath: string): string | null {
  if (!existsSync(buildGradlePath)) return null;
  return parseAarVersion(readFileSync(buildGradlePath, 'utf-8'));
}

/**
 * Add or update the implementation AAR dependency in build.gradle.
 * Returns 'added', 'updated', or 'already_present'.
 */
export function addAarDependency(
  buildGradlePath: string,
  atakVersion: string,
  version: string,
): 'added' | 'updated' | 'already_present' {
  let content = readFileSync(buildGradlePath, 'utf-8');
  const dep = `dev.atakreactive:bridge-${atakVersion}:${version}`;

  // Already has this exact dependency
  if (content.includes(dep)) return 'already_present';

  // Has an older version — update it
  const existingPattern = /implementation\s+["']dev\.atakreactive:bridge-[\d.]+:[\d.]+["']/;
  if (existingPattern.test(content)) {
    content = content.replace(existingPattern, `implementation "${dep}"`);
    writeFileSync(buildGradlePath, content);
    return 'updated';
  }

  // Add new dependency — find the project-level dependencies block
  const depsRegex = /dependencies\s*\{[^}]*implementation\s+fileTree/;
  const depsMatch = depsRegex.exec(content);
  if (depsMatch) {
    const depsIdx = content.indexOf('dependencies', depsMatch.index);
    const braceIdx = content.indexOf('{', depsIdx);
    const depLine = `\n    implementation "${dep}"`;
    content = content.slice(0, braceIdx + 1) + depLine + content.slice(braceIdx + 1);
    writeFileSync(buildGradlePath, content);
    return 'added';
  }

  return 'added';
}

/**
 * Remove the source-copy installation (com/atakmap/android/reactive/ dir and .atak-reactive-version).
 */
export function removeSourceInstall(appDir: string, projectRoot: string): number {
  const reactiveDir = join(appDir, 'src/main/java/com/atakmap/android/reactive');
  const versionFile = join(projectRoot, '.atak-reactive-version');

  let removed = 0;
  if (existsSync(reactiveDir)) {
    const files = findJavaFiles(reactiveDir);
    removed = files.length;
    rmSync(reactiveDir, { recursive: true, force: true });
  }
  if (existsSync(versionFile)) {
    rmSync(versionFile);
  }
  return removed;
}

export function injectReactiveRegistration(
  filePath: string,
  intentAction: string,
): 'injected' | 'already_exists' | 'failed' {
  const content = readFileSync(filePath, 'utf-8');

  // Check if already registered
  if (content.includes('ReactiveDropDown')) {
    return 'already_exists';
  }

  // Find the last registerDropDownReceiver call to insert after
  const registerPattern = /this\.registerDropDownReceiver\([^)]+\);/g;
  let lastMatch: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;
  while ((match = registerPattern.exec(content)) !== null) {
    lastMatch = match;
  }

  if (!lastMatch) {
    return 'failed';
  }

  const insertPos = lastMatch.index + lastMatch[0].length;

  const registration = `

        // atak-reactive: React-based screen
        ReactiveDropDown reactScreen = new ReactiveDropDown(view, context, "web/index.html");
        DocumentedIntentFilter reactFilter = new DocumentedIntentFilter();
        reactFilter.addAction("${intentAction}",
                "React screen powered by atak-reactive");
        this.registerDropDownReceiver(reactScreen, reactFilter);`;

  // Add import if missing
  let patched = content;
  if (!content.includes('import com.atakmap.android.reactive.ReactiveDropDown')) {
    const firstImport = content.indexOf('import ');
    if (firstImport !== -1) {
      patched = content.slice(0, firstImport) +
        'import com.atakmap.android.reactive.ReactiveDropDown;\n' +
        content.slice(firstImport);
    }
  }

  // Recalculate insert position after import was added
  const offset = patched.length - content.length;
  const adjustedPos = insertPos + offset;

  patched = patched.slice(0, adjustedPos) + registration + patched.slice(adjustedPos);

  writeFileSync(filePath, patched);
  return 'injected';
}
