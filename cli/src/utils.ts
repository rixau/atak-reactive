import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { execSync, type SpawnSyncReturns } from 'child_process';

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
