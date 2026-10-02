import {
  on,
  off,
  getPreference,
  setPreference,
  removePreference,
  sendBroadcast,
} from '@atak-reactive/sdk';

// End-to-end check for #65: preferences ATAK stores as booleans, numbers and
// string sets must reach JS as strings, through both preferenceChanged and
// getPreference, and a string value must cross into the WebView intact without
// being able to run code on the way.

interface Result {
  name: string;
  pass: boolean;
  detail?: string;
}

// Written natively by PrefTestReceiver: the bridge itself can only write strings.
const TYPED_PREFIX = 'test.reactive.typed.';
const TYPED_EXPECTED: Record<string, string> = {
  bool: 'true',
  int: '42',
  long: '9000000000',
  float: '1.5',
  set: '["a"]',
};
const PREF_TEST_ACTION = 'dev.atakreactive.example.PREF_TEST';

const HOSTILE_KEY = 'test.reactive.hostile';
// Characters that end a string literal or a line. Any of them used to break the
// script the payload is pasted into, so the event never arrived.
const HOSTILE_VALUE = 'a\\b"c\nd\re f g\'h`i</script>';

const INJECTION_KEY = 'test.reactive.injection';
// Closes the string and the object the old hand-built payload produced, then
// comments out the rest. No line breaks: those would stop the script from
// parsing at all and hide whether the injection itself works.
const INJECTION_VALUE = 'a\\"+(window.__prefInjected=1)})//';

const TIMEOUT_MS = 3000;

type Changed = { key: string; value: string | null };

/** Collects preferenceChanged events for `keys` until each has been seen or the timeout passes. */
function collect(keys: string[], trigger: () => void): Promise<Map<string, string | null>> {
  return new Promise(resolve => {
    const seen = new Map<string, string | null>();
    const handler = (e: Changed) => {
      if (keys.includes(e.key)) seen.set(e.key, e.value);
      if (seen.size === keys.length) finish();
    };
    const timer = setTimeout(() => finish(), TIMEOUT_MS);
    function finish() {
      clearTimeout(timer);
      off('preferenceChanged', handler);
      resolve(seen);
    }
    on('preferenceChanged', handler);
    trigger();
  });
}

/** For collected events, where undefined means the event never arrived. */
function show(v: string | null | undefined): string {
  return v === undefined ? 'no event' : JSON.stringify(v);
}

/** For getPreference reads, where undefined means the bridge returned a bare Java null. */
function showRead(v: string | null | undefined): string {
  return v === undefined ? 'undefined' : JSON.stringify(v);
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Removes every key this page writes. Removing an absent key is a no-op. */
function removeTestKeys() {
  sendBroadcast(PREF_TEST_ACTION, { op: 'clear' });
  removePreference(HOSTILE_KEY);
  removePreference(INJECTION_KEY);
}

/**
 * SharedPreferences notifies listeners only when a value actually changes. A run
 * that died between writing and clearing (ATAK killed, panel closed) leaves the
 * test keys set, and the next run's writes then fire no events at all, so every
 * "arrives as" check would time out with "no event". Start from a clean slate.
 *
 * Resolves to the keys that were still set after the timeout; empty means clean.
 */
async function clearLeftovers(keys: string[]): Promise<string[]> {
  const dirty = () => keys.filter(k => getPreference(k) != null);
  if (dirty().length === 0) return [];
  removeTestKeys();
  // The typed clear goes through a broadcast, so it lands asynchronously.
  const deadline = Date.now() + TIMEOUT_MS;
  while (dirty().length > 0 && Date.now() < deadline) await delay(50);
  // Let the null preferenceChanged events from the removal reach the WebView,
  // so the write step below does not mistake them for its own.
  await delay(500);
  return dirty();
}

export async function runPreferenceTypeTests(): Promise<Result[]> {
  const results: Result[] = [];
  const typedKeys = Object.keys(TYPED_EXPECTED).map(k => TYPED_PREFIX + k);

  try {
    const leftover = await clearLeftovers([...typedKeys, HOSTILE_KEY, INJECTION_KEY]);
    if (leftover.length > 0) {
      results.push({
        name: 'preference test keys start cleared',
        pass: false,
        detail: `still set: ${leftover.join(' ')}`,
      });
    }

    await runChecks(results, typedKeys);
  } finally {
    // Whatever happened above, do not leave test keys behind for the next run.
    try {
      removeTestKeys();
    } catch {
      // The bridge is gone; the next run's clearLeftovers will handle it.
    }
  }

  return results;
}

async function runChecks(results: Result[], typedKeys: string[]) {
  // --- Typed values written natively ---
  const written = await collect(typedKeys, () =>
    sendBroadcast(PREF_TEST_ACTION, { op: 'write' }));
  for (const [suffix, expected] of Object.entries(TYPED_EXPECTED)) {
    const key = TYPED_PREFIX + suffix;
    const got = written.get(key);
    results.push({
      name: `preferenceChanged ${suffix} arrives as string`,
      pass: got === expected,
      detail: `${show(got)}, want ${JSON.stringify(expected)}`,
    });
    const read = getPreference(key);
    results.push({
      name: `getPreference ${suffix} reads as string`,
      pass: read === expected,
      detail: `${showRead(read)}, want ${JSON.stringify(expected)}`,
    });
  }

  // --- Removing them reports null ---
  const cleared = await collect(typedKeys, () =>
    sendBroadcast(PREF_TEST_ACTION, { op: 'clear' }));
  const allNull = typedKeys.every(k => cleared.has(k) && cleared.get(k) === null);
  results.push({
    name: 'preferenceChanged reports null on remove',
    pass: allNull,
    detail: typedKeys.map(k => `${k.slice(TYPED_PREFIX.length)}=${show(cleared.get(k))}`).join(' '),
  });

  // --- A hostile string round-trips intact ---
  const hostile = await collect([HOSTILE_KEY], () => setPreference(HOSTILE_KEY, HOSTILE_VALUE));
  results.push({
    name: 'preferenceChanged delivers hostile string intact',
    pass: hostile.get(HOSTILE_KEY) === HOSTILE_VALUE,
    detail: show(hostile.get(HOSTILE_KEY)),
  });
  const hostileRead = getPreference(HOSTILE_KEY);
  results.push({
    name: 'getPreference reads hostile string intact',
    pass: hostileRead === HOSTILE_VALUE,
    detail: showRead(hostileRead),
  });

  // --- A crafted string arrives intact and cannot run code ---
  // One check: "not injected" on its own also passes when no event arrived at
  // all, which proves nothing. The payload must have been evaluated (the event
  // arrived, value intact) and must not have run the crafted code.
  const w = window as unknown as { __prefInjected?: number };
  delete w.__prefInjected;
  const injected = await collect([INJECTION_KEY], () => setPreference(INJECTION_KEY, INJECTION_VALUE));
  const crafted = injected.get(INJECTION_KEY);
  const ran = w.__prefInjected !== undefined;
  results.push({
    name: 'crafted preference value arrives intact without running code',
    pass: crafted === INJECTION_VALUE && !ran,
    detail: `${ran ? 'INJECTED' : 'not injected'}, value ${show(crafted)}`,
  });

  // --- An absent key reads as null ---
  const absent = getPreference('test.reactive.never-written');
  results.push({
    name: 'getPreference returns null for an absent key',
    pass: absent === null,
    detail: showRead(absent),
  });
}
