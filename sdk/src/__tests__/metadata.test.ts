import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createMockBridge } from './setup';
import { makeMapItem, emitFromNative } from './helpers';

function loadModules() {
  return import('../index');
}

describe('metadata read/write', () => {
  it('setItemMeta calls bridge with correct args', async () => {
    const setMetaFn = vi.fn(() => 'true');
    window._atak = createMockBridge({ setItemMeta: setMetaFn });

    const { setItemMeta } = await loadModules();
    const result = setItemMeta('uid-1', 'mission-status', 'complete');

    expect(setMetaFn).toHaveBeenCalledWith('uid-1', 'mission-status', 'complete');
    expect(result).toBe(true);
  });

  it('setItemMeta returns false when item not found', async () => {
    window._atak = createMockBridge({ setItemMeta: () => 'false' });

    const { setItemMeta } = await loadModules();
    expect(setItemMeta('nonexistent', 'key', 'val')).toBe(false);
  });

  it('setItemMetaDouble calls bridge with double value', async () => {
    const setMetaFn = vi.fn(() => 'true');
    window._atak = createMockBridge({ setItemMetaDouble: setMetaFn });

    const { setItemMetaDouble } = await loadModules();
    setItemMetaDouble('uid-1', 'priority', 3.14);

    expect(setMetaFn).toHaveBeenCalledWith('uid-1', 'priority', 3.14);
  });

  it('setItemMetaBool calls bridge with boolean value', async () => {
    const setMetaFn = vi.fn(() => 'true');
    window._atak = createMockBridge({ setItemMetaBool: setMetaFn });

    const { setItemMetaBool } = await loadModules();
    setItemMetaBool('uid-1', 'locked', true);

    expect(setMetaFn).toHaveBeenCalledWith('uid-1', 'locked', true);
  });

  it('getItemMeta returns string value', async () => {
    window._atak = createMockBridge({
      getItemMeta: (_uid: string, _key: string) => 'complete',
    });

    const { getItemMeta } = await loadModules();
    expect(getItemMeta('uid-1', 'mission-status')).toBe('complete');
  });

  it('getItemMeta returns null when key missing', async () => {
    window._atak = createMockBridge();

    const { getItemMeta } = await loadModules();
    expect(getItemMeta('uid-1', 'nonexistent')).toBeNull();
  });

  it('metadata write triggers reactive update via ITEM_REFRESH pipeline', async () => {
    const item = makeMapItem({ uid: 'target', title: 'Original' });
    window._atak = createMockBridge({
      getMapItemsSnapshot: () => JSON.stringify([item]),
      setItemMeta: () => 'true',
    });

    const { useMapItems, setItemMeta } = await loadModules();
    const { result } = renderHook(() => useMapItems());

    expect(result.current).toHaveLength(1);
    expect(result.current[0]!.title).toBe('Original');

    // Simulate: setItemMeta triggers ITEM_REFRESH on Java side,
    // relay serializes updated item, pushes mapItemsChanged event
    setItemMeta('target', 'remarks', 'tagged');

    act(() => {
      emitFromNative('mapItemsChanged', {
        added: [],
        removed: [],
        updated: [makeMapItem({ uid: 'target', title: 'Original', remarks: 'tagged' })],
      });
    });

    expect(result.current).toHaveLength(1);
    expect(result.current[0]!.remarks).toBe('tagged');
  });
});
