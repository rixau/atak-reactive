import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Every event the SDK declares must actually be emitted by the Java bridge.
 *
 * `navVisible` and `menuAction` were both declared in AtakEventMap, hooked
 * (useNavVisible, useMenuAction), documented in the README, and covered by
 * passing tests — while nothing in lib/ ever emitted them. The hooks were dead on
 * arrival and no test noticed, because every event test pushes through the JS bus
 * directly and so never exercises the producer side at all.
 *
 * This is the only check in the suite that looks at both ends.
 */

const here = dirname(fileURLToPath(import.meta.url));
const libSrc = join(here, '..', '..', '..', 'lib', 'src');
const eventsFile = join(here, '..', 'types', 'events.ts');

function javaSources(dir: string): string[] {
  return readdirSync(dir, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith('.java'))
    .map((f) => join(dir, f));
}

/**
 * Comments and log strings must not count as emitters: a deleted listener whose
 * explanatory comment still says emit("navVisible") would otherwise keep this
 * test green — the exact regression class it exists to catch.
 */
function stripJavaComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/** Names in AtakEventMap, read from the type declaration itself. */
function declaredEvents(): string[] {
  const src = readFileSync(eventsFile, 'utf-8');
  const block = /export type AtakEventMap = \{([\s\S]*?)\n\};/.exec(src);
  if (!block) throw new Error('could not locate AtakEventMap in types/events.ts');
  return [...block[1]!.matchAll(/^\s{2}(\w+)\s*:/gm)].map((m) => m[1]!);
}

/** Event names passed to emit("...") anywhere in the Java bridge. */
function emittedEvents(): Set<string> {
  const names = new Set<string>();
  for (const f of javaSources(libSrc)) {
    const src = stripJavaComments(readFileSync(f, 'utf-8'));
    for (const m of src.matchAll(/\bemit\(\s*"([A-Za-z]\w*)"/g)) names.add(m[1]!);
  }
  return names;
}

// The SDK publishes standalone; lib/ only exists in the monorepo checkout.
const runnable = existsSync(libSrc);

// Computed once — both assertions read the same walk of lib/ and parse of events.ts.
const emitted = runnable ? emittedEvents() : new Set<string>();
const declared = runnable ? declaredEvents() : [];

describe.skipIf(!runnable)('AtakEventMap ↔ Java emitters', () => {
  it('every declared event is emitted somewhere in lib/', () => {
    expect(declared.length).toBeGreaterThan(0);

    const orphans = declared.filter((e) => !emitted.has(e));
    expect(
      orphans,
      `Declared in AtakEventMap but never emitted by the bridge: ${orphans.join(', ')}. ` +
        `Either emit it from lib/, or remove the event and its hook.`,
    ).toEqual([]);
  });

  it('every event the bridge emits is declared in AtakEventMap', () => {
    const declaredSet = new Set(declared);
    const undeclared = [...emitted].filter((e) => !declaredSet.has(e));
    expect(
      undeclared,
      `Emitted by the bridge but absent from AtakEventMap, so untyped for consumers: ` +
        `${undeclared.join(', ')}`,
    ).toEqual([]);
  });
});
