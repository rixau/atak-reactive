import { existsSync, readFileSync, readdirSync, writeFileSync, appendFileSync, mkdirSync } from 'fs';
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
export function detectAtakVersion(buildGradlePath: string): string | null {
  if (!existsSync(buildGradlePath)) return null;
  const content = readFileSync(buildGradlePath, 'utf-8');
  const match = content.match(/ATAK_VERSION\s*=\s*['"](\d+\.\d+\.\d+)['"]/);
  return match?.[1] ?? null;
}

/**
 * Find the best matching template version for the detected ATAK version.
 * Uses major.minor matching — e.g. ATAK 5.6.1 matches templates/5.6.0/
 */
export function resolveTemplateVersion(
  templatesDir: string,
  atakVersion: string,
): string | null {
  if (!existsSync(templatesDir)) return null;

  const available = readdirSync(templatesDir)
    .filter((d) => /^\d+\.\d+\.\d+$/.test(d))
    .sort()
    .reverse(); // newest first

  // Exact match
  if (available.includes(atakVersion)) return atakVersion;

  // Major.minor match (5.6.1 → 5.6.0)
  const [major, minor] = atakVersion.split('.');
  const minorMatch = available.find((v) => v.startsWith(`${major}.${minor}.`));
  if (minorMatch) return minorMatch;

  // Major match (5.7.0 → latest 5.x)
  const majorMatch = available.find((v) => v.startsWith(`${major}.`));
  if (majorMatch) return majorMatch;

  return null;
}

/**
 * List all supported ATAK versions (template directories).
 */
export function listSupportedVersions(templatesDir: string): string[] {
  if (!existsSync(templatesDir)) return [];
  return readdirSync(templatesDir)
    .filter((d) => /^\d+\.\d+\.\d+$/.test(d))
    .sort();
}

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
 * Inject ReactiveDropDown registration into a MapComponent file.
 * Returns what was done.
 */
/**
 * Copy Java template files to destination, injecting version headers and
 * replacing the getBridgeVersion() placeholder.
 * Returns the number of files copied.
 */
export function copyJavaTemplatesWithInjection(
  srcDir: string,
  destDir: string,
  version: string,
): number {
  const header =
    `// Generated by atak-reactive v${version} — do not edit manually.\n` +
    `// Run 'npx @atak-reactive/cli init' to update.\n\n`;

  const files = findJavaFiles(srcDir);
  for (const srcPath of files) {
    const relPath = relative(srcDir, srcPath);
    const destPath = join(destDir, relPath);
    mkdirSync(dirname(destPath), { recursive: true });

    let content = readFileSync(srcPath, 'utf-8');
    // Replace getBridgeVersion() placeholder
    content = content.replace(
      /return "0\.0\.0";/,
      `return "${version}";`,
    );
    writeFileSync(destPath, header + content);
  }
  return files.length;
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
