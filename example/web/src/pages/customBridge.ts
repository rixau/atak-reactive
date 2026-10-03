import { on, off, type AtakEventMap, type AtakEventName } from '@atak-reactive/sdk';

// End-to-end check for #81: ExampleBridge is registered with
// addBridge("example", ...), so it must be window._example in every build,
// including the minified release build that renames its class. Its events go
// through ReactiveDropDown.emit, and the built-in bridge must still be _atak.

interface Result {
  name: string;
  pass: boolean;
  detail?: string;
}

interface ExampleBridge {
  echo(value: string): string;
  ping(token: string): void;
}

declare global {
  interface Window {
    _example?: ExampleBridge;
  }
}

const PING_EVENT = 'exampleBridgePing';
const TIMEOUT_MS = 2000;

type Ping = { token: string };

// on()/off() are typed to the SDK's built-in events. A custom bridge's events
// arrive through the same dispatcher, so the name and handler are cast.
const onPing = (fn: (p: Ping) => void) =>
  on(PING_EVENT as AtakEventName, fn as unknown as (d: AtakEventMap[AtakEventName]) => void);
const offPing = (fn: (p: Ping) => void) =>
  off(PING_EVENT as AtakEventName, fn as unknown as (d: AtakEventMap[AtakEventName]) => void);

export async function runCustomBridgeTests(): Promise<Result[]> {
  const results: Result[] = [];
  const bridge = window._example;

  results.push({
    name: 'custom bridge is window._example',
    pass: typeof bridge?.echo === 'function' && typeof bridge?.ping === 'function',
    detail: bridge ? 'present' : 'undefined',
  });

  // The built-in bridge, not a custom one that took its name.
  const atak = window._atak;
  results.push({
    name: 'window._atak is still the core bridge',
    pass: typeof atak?.subscribe === 'function' && typeof atak?.getSelfLocation === 'function',
  });

  if (!bridge) {
    results.push({ name: 'custom bridge echo', pass: false, detail: 'no bridge' });
    results.push({ name: 'custom bridge event reaches JS', pass: false, detail: 'no bridge' });
    return results;
  }

  try {
    const value = 'héllo "bridge"';
    const echoed = bridge.echo(value);
    results.push({ name: 'custom bridge echo', pass: echoed === value, detail: echoed });
  } catch (e) {
    results.push({ name: 'custom bridge echo', pass: false, detail: String(e) });
  }

  const token = `t${Date.now()}`;
  const received = await new Promise<string | null>(resolve => {
    const handler = (p: Ping) => {
      if (p?.token !== token) return;
      finish(p.token);
    };
    const timer = setTimeout(() => finish(null), TIMEOUT_MS);
    function finish(value: string | null) {
      clearTimeout(timer);
      offPing(handler);
      resolve(value);
    }
    onPing(handler);
    try {
      bridge.ping(token);
    } catch (e) {
      console.error('[test] _example.ping threw', e);
    }
  });
  results.push({
    name: 'custom bridge event reaches JS',
    pass: received === token,
    detail: received ?? `no ${PING_EVENT} within ${TIMEOUT_MS}ms`,
  });

  return results;
}
