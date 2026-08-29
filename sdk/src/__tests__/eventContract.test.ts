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
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...javaSources(p));
    else if (e.name.endsWith('.java')) out.push(p);
  }
  return out;
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
    const src = readFileSync(f, 'utf-8');
    for (const m of src.matchAll(/\bemit\(\s*"([A-Za-z]\w*)"/g)) names.add(m[1]!);
  }
  return names;
}

// The SDK publishes standalone; lib/ only exists in the monorepo checkout.
const runnable = existsSync(libSrc);

describe.skipIf(!runnable)('AtakEventMap ↔ Java emitters', () => {
  it('every declared event is emitted somewhere in lib/', () => {
    const emitted = emittedEvents();
    const declared = declaredEvents();
    expect(declared.length).toBeGreaterThan(0);

    const orphans = declared.filter((e) => !emitted.has(e));
    expect(
      orphans,
      `Declared in AtakEventMap but never emitted by the bridge: ${orphans.join(', ')}. ` +
        `Either emit it from lib/, or remove the event and its hook.`,
    ).toEqual([]);
  });

  it('every event the bridge emits is declared in AtakEventMap', () => {
    const declared = new Set(declaredEvents());
    const undeclared = [...emittedEvents()].filter((e) => !declared.has(e));
    expect(
      undeclared,
      `Emitted by the bridge but absent from AtakEventMap, so untyped for consumers: ` +
        `${undeclared.join(', ')}`,
    ).toEqual([]);
  });
});
