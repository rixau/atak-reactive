import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockBridge } from './setup';
import { makeMapItem, emitFromNative } from './helpers';

// Fresh import each test
async function loadModules() {
  const mod = await import('../stores/MapItemStore');
  return mod;
}

describe('MapItemStore', () => {
  it('seeds from snapshot on first subscribe', async () => {
    const items = [makeMapItem({ uid: 'a' }), makeMapItem({ uid: 'b' })];
    window._atak = createMockBridge({
      getMapItemsSnapshot: () => JSON.stringify(items),
    });

    const { mapItemStore } = await loadModules();
    const cb = vi.fn();
    mapItemStore.subscribe(undefined, cb);

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0]![0]).toHaveLength(2);
  });

  it('ref-counts start/stop of native stream', async () => {
    const startFn = vi.fn();
    const stopFn = vi.fn();

    window._atak = createMockBridge({
      startMapItemStream: startFn,
      stopMapItemStream: stopFn,
    });

    const { mapItemStore } = await loadModules();

    const unsub1 = mapItemStore.subscribe(undefined, vi.fn());
    expect(startFn).toHaveBeenCalledTimes(1);

    const unsub2 = mapItemStore.subscribe(undefined, vi.fn());
    // Should NOT start again
    expect(startFn).toHaveBeenCalledTimes(1);

    unsub1();
    // Still one subscriber
    expect(stopFn).not.toHaveBeenCalled();

    unsub2();
    expect(stopFn).toHaveBeenCalledTimes(1);
  });

  it('applies diffs from events and notifies subscribers', async () => {
    window._atak = createMockBridge({
      getMapItemsSnapshot: () => JSON.stringify([makeMapItem({ uid: 'x' })]),
    });

    const { mapItemStore } = await loadModules();
    const cb = vi.fn();
    mapItemStore.subscribe(undefined, cb);

    // Initial call
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0]![0]).toHaveLength(1);

    // Emit an add
    emitFromNative('mapItemsChanged', {
      added: [makeMapItem({ uid: 'y' })],
      removed: [],
      updated: [],
    });

    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb.mock.calls[1]![0]).toHaveLength(2);
  });

  it('filters items for subscribers with filters', async () => {
    window._atak = createMockBridge({
      getMapItemsSnapshot: () => JSON.stringify([
        makeMapItem({ uid: 'friendly', type: 'a-f-G' }),
        makeMapItem({ uid: 'hostile', type: 'a-h-G' }),
      ]),
    });

    const { mapItemStore } = await loadModules();
    const cb = vi.fn();
    mapItemStore.subscribe({ type: 'a-f-*' }, cb);

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0]![0]).toHaveLength(1);
    expect(cb.mock.calls[0]![0][0].uid).toBe('friendly');
  });

  it('structural subscribers only fire on add/remove, not update', async () => {
    window._atak = createMockBridge({
      getMapItemsSnapshot: () => JSON.stringify([makeMapItem({ uid: 'a' })]),
    });

    const { mapItemStore } = await loadModules();
    const structCb = vi.fn();
    mapItemStore.subscribeStructural(structCb);

    // Update — should NOT fire
    emitFromNative('mapItemsChanged', {
      added: [],
      removed: [],
      updated: [makeMapItem({ uid: 'a', title: 'Updated' })],
    });
    expect(structCb).not.toHaveBeenCalled();

    // Add — should fire
    emitFromNative('mapItemsChanged', {
      added: [makeMapItem({ uid: 'b' })],
      removed: [],
      updated: [],
    });
    expect(structCb).toHaveBeenCalledTimes(1);
  });
});
