import { describe, it, expect, vi } from 'vitest';
import { createMockBridge } from './setup';
import { makeMapItem, emitFromNative } from './helpers';
import type { MapItemData } from '../types';

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

  // Regression: the store used to seed exactly once per page load, while the
  // event subscription was torn down every time the last hook unmounted. Any
  // change that happened in that gap was lost permanently — a panel would go
  // on listing markers that had already been deleted from the map.
  it('re-seeds on stream restart so changes missed while unsubscribed are not lost', async () => {
    let snapshot = [makeMapItem({ uid: 'a' })];
    window._atak = createMockBridge({
      getMapItemsSnapshot: () => JSON.stringify(snapshot),
    });

    const { mapItemStore } = await loadModules();

    const cb1 = vi.fn();
    const unsub = mapItemStore.subscribe(undefined, cb1);
    expect(cb1.mock.calls[0]![0].map((i: MapItemData) => i.uid)).toEqual(['a']);

    // Last subscriber goes away: user switches to a tab with no map-item hook.
    unsub();

    // Map changes with nobody listening — 'a' is removed, 'b' arrives.
    snapshot = [makeMapItem({ uid: 'b' })];

    const cb2 = vi.fn();
    mapItemStore.subscribe(undefined, cb2);

    const uids = cb2.mock.calls[0]![0].map((i: MapItemData) => i.uid);
    expect(uids).toEqual(['b']);
    expect(uids).not.toContain('a');
  });

  it('does not re-seed while the stream is already running', async () => {
    const snapshot = vi.fn(() => JSON.stringify([makeMapItem({ uid: 'a' })]));
    window._atak = createMockBridge({ getMapItemsSnapshot: snapshot });

    const { mapItemStore } = await loadModules();

    mapItemStore.subscribe(undefined, vi.fn());
    expect(snapshot).toHaveBeenCalledTimes(1);

    // A second hook mounting must not pay for another snapshot.
    mapItemStore.subscribe(undefined, vi.fn());
    expect(snapshot).toHaveBeenCalledTimes(1);
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

  describe('bridgeResumed (panel re-attached after #88 pause)', () => {
    it('replaces the store with a fresh snapshot and notifies subscribers', async () => {
      // Closed with a, b, c on the map. While paused nothing was delivered:
      // b was removed, c moved, d was added.
      let snapshot = [
        makeMapItem({ uid: 'a' }),
        makeMapItem({ uid: 'b' }),
        makeMapItem({ uid: 'c', lat: 1 }),
      ];
      window._atak = createMockBridge({
        getMapItemsSnapshot: () => JSON.stringify(snapshot),
      });

      const { mapItemStore } = await loadModules();
      const cb = vi.fn();
      const structCb = vi.fn();
      mapItemStore.subscribe(undefined, cb);
      mapItemStore.subscribeStructural(structCb);
      expect(cb.mock.lastCall![0]).toHaveLength(3);

      snapshot = [
        makeMapItem({ uid: 'a' }),
        makeMapItem({ uid: 'c', lat: 2 }),
        makeMapItem({ uid: 'd' }),
      ];
      emitFromNative('bridgeResumed', {});

      const items = cb.mock.lastCall![0] as MapItemData[];
      expect(items.map((i) => i.uid).sort()).toEqual(['a', 'c', 'd']);
      expect(items.find((i) => i.uid === 'c')!.lat).toBe(2);
      expect(mapItemStore.getByUid('b')).toBeUndefined();
      expect(structCb).toHaveBeenCalledTimes(1);
    });

    it('keeps applying diffs after the re-sync', async () => {
      let snapshot = [makeMapItem({ uid: 'a' })];
      window._atak = createMockBridge({
        getMapItemsSnapshot: () => JSON.stringify(snapshot),
      });

      const { mapItemStore } = await loadModules();
      const cb = vi.fn();
      mapItemStore.subscribe(undefined, cb);

      snapshot = [];
      emitFromNative('bridgeResumed', {});
      expect(cb.mock.lastCall![0]).toHaveLength(0);

      emitFromNative('mapItemsChanged', {
        added: [makeMapItem({ uid: 'z' })],
        removed: [],
        updated: [],
      });
      expect((cb.mock.lastCall![0] as MapItemData[]).map((i) => i.uid)).toEqual(['z']);
    });

    it('does not re-fetch once the stream has stopped', async () => {
      const snapshotFn = vi.fn(() => '[]');
      window._atak = createMockBridge({ getMapItemsSnapshot: snapshotFn });

      const { mapItemStore } = await loadModules();
      const unsub = mapItemStore.subscribe(undefined, vi.fn());
      expect(snapshotFn).toHaveBeenCalledTimes(1);
      unsub();

      emitFromNative('bridgeResumed', {});
      expect(snapshotFn).toHaveBeenCalledTimes(1);
    });
  });
});
