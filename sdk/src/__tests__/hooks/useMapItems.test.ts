import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createMockBridge } from '../setup';
import { makeMapItem, emitFromNative } from '../helpers';

function loadModules() {
  return import('../../index');
}

describe('useMapItems', () => {
  it('returns initial snapshot', async () => {
    const items = [makeMapItem({ uid: 'a' }), makeMapItem({ uid: 'b' })];
    window._atak = createMockBridge({
      getMapItemsSnapshot: () => JSON.stringify(items),
    });

    const { useMapItems } = await loadModules();
    const { result } = renderHook(() => useMapItems());

    expect(result.current).toHaveLength(2);
  });

  it('updates when items are added via events', async () => {
    window._atak = createMockBridge();

    const { useMapItems } = await loadModules();
    const { result } = renderHook(() => useMapItems());

    expect(result.current).toHaveLength(0);

    act(() => {
      emitFromNative('mapItemsChanged', {
        added: [makeMapItem({ uid: 'new-1' })],
        removed: [],
        updated: [],
      });
    });

    expect(result.current).toHaveLength(1);
    expect(result.current[0]!.uid).toBe('new-1');
  });

  it('removes items from events', async () => {
    const items = [makeMapItem({ uid: 'x' }), makeMapItem({ uid: 'y' })];
    window._atak = createMockBridge({
      getMapItemsSnapshot: () => JSON.stringify(items),
    });

    const { useMapItems } = await loadModules();
    const { result } = renderHook(() => useMapItems());

    act(() => {
      emitFromNative('mapItemsChanged', {
        added: [],
        removed: ['x'],
        updated: [],
      });
    });

    expect(result.current).toHaveLength(1);
    expect(result.current[0]!.uid).toBe('y');
  });

  it('applies filter', async () => {
    const items = [
      makeMapItem({ uid: 'f1', type: 'a-f-G' }),
      makeMapItem({ uid: 'h1', type: 'a-h-G' }),
    ];
    window._atak = createMockBridge({
      getMapItemsSnapshot: () => JSON.stringify(items),
    });

    const { useMapItems } = await loadModules();
    const { result } = renderHook(() => useMapItems({ type: 'a-f-*' }));

    expect(result.current).toHaveLength(1);
    expect(result.current[0]!.uid).toBe('f1');
  });

  it('stops stream on unmount', async () => {
    const stopFn = vi.fn();
    window._atak = createMockBridge({ stopMapItemStream: stopFn });

    const { useMapItems } = await loadModules();
    const { unmount } = renderHook(() => useMapItems());

    unmount();
    expect(stopFn).toHaveBeenCalled();
  });
});
