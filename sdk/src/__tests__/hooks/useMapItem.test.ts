import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createMockBridge } from '../setup';
import { makeMapItem, emitFromNative } from '../helpers';

function loadModules() {
  return import('../../index');
}

describe('useMapItem', () => {
  it('returns item by UID from snapshot', async () => {
    const items = [makeMapItem({ uid: 'target', title: 'Target' })];
    window._atak = createMockBridge({
      getMapItemsSnapshot: () => JSON.stringify(items),
    });

    const { useMapItem } = await loadModules();
    const { result } = renderHook(() => useMapItem('target'));

    expect(result.current).not.toBeNull();
    expect(result.current!.title).toBe('Target');
  });

  it('returns null for unknown UID', async () => {
    window._atak = createMockBridge();

    const { useMapItem } = await loadModules();
    const { result } = renderHook(() => useMapItem('nonexistent'));

    expect(result.current).toBeNull();
  });

  it('updates when tracked item changes', async () => {
    const items = [makeMapItem({ uid: 'moving', lat: 38.0 })];
    window._atak = createMockBridge({
      getMapItemsSnapshot: () => JSON.stringify(items),
    });

    const { useMapItem } = await loadModules();
    const { result } = renderHook(() => useMapItem('moving'));

    act(() => {
      emitFromNative('mapItemsChanged', {
        added: [],
        removed: [],
        updated: [makeMapItem({ uid: 'moving', lat: 39.5 })],
      });
    });

    expect(result.current!.lat).toBe(39.5);
  });

  it('becomes null when tracked item is removed', async () => {
    const items = [makeMapItem({ uid: 'doomed' })];
    window._atak = createMockBridge({
      getMapItemsSnapshot: () => JSON.stringify(items),
    });

    const { useMapItem } = await loadModules();
    const { result } = renderHook(() => useMapItem('doomed'));

    expect(result.current).not.toBeNull();

    act(() => {
      emitFromNative('mapItemsChanged', {
        added: [],
        removed: ['doomed'],
        updated: [],
      });
    });

    expect(result.current).toBeNull();
  });
});
