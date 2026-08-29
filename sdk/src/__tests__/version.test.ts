import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockBridge } from './setup';

/**
 * The bridge reported a hardcoded "0.0.0" through 0.2.0, so every correctly matched
 * install printed a mismatch warning and no real mismatch could be detected. These
 * tests pin both halves of the check.
 *
 * `versionChecked` latches on first use, so each case needs a fresh module registry.
 */
async function load() {
  vi.resetModules();
  return import('../index');
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
});

describe('bridge/SDK version check', () => {
  it('stays silent when the bridge version matches the SDK', async () => {
    const { SDK_VERSION } = await import('../index');
    window._atak = createMockBridge({ getBridgeVersion: () => SDK_VERSION });

    const { isNative, getMapCenter } = await load();
    expect(isNative()).toBe(true);
    getMapCenter();

    expect(warn).not.toHaveBeenCalled();
  });

  it('warns once, naming both versions, when they differ', async () => {
    window._atak = createMockBridge({ getBridgeVersion: () => '9.9.9' });

    const { getMapCenter, SDK_VERSION } = await load();
    getMapCenter();
    getMapCenter();

    expect(warn).toHaveBeenCalledTimes(1);
    const msg = String(warn.mock.calls[0]![0]);
    expect(msg).toContain('9.9.9');
    expect(msg).toContain(SDK_VERSION);
  });

  it('names the ATAK build when the bridge reports one', async () => {
    window._atak = createMockBridge({
      getBridgeVersion: () => '9.9.9',
      getBridgeAtakVersion: () => '5.4.0',
    });

    const { getMapCenter } = await load();
    getMapCenter();

    expect(String(warn.mock.calls[0]![0])).toContain('built against ATAK 5.4.0');
  });

  it('omits the ATAK build for a bridge too old to report one', async () => {
    window._atak = createMockBridge({ getBridgeVersion: () => '9.9.9' });

    const { getMapCenter } = await load();
    getMapCenter();

    expect(String(warn.mock.calls[0]![0])).not.toContain('built against ATAK');
  });

  it('does not warn against the mock bridge used in browser dev', async () => {
    delete window._atak;

    const { getMapCenter } = await load();
    getMapCenter();

    expect(warn).not.toHaveBeenCalled();
  });
});
