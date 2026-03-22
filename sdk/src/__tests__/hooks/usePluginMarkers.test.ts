import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createMockBridge } from '../setup';
import { makeMapItem, emitFromNative } from '../helpers';

function loadModules() {
  return import('../../index');
}

describe('usePluginMarkers', () => {
  it('returns only managed markers', async () => {
    window._atak = createMockBridge({
      addMarker: () => 'managed-1',
      getMapItemsSnapshot: () => JSON.stringify([
        makeMapItem({ uid: 'managed-1', title: 'Mine' }),
        makeMapItem({ uid: 'external-1', title: 'Not mine' }),
      ]),
    });

    const { addMarker, usePluginMarkers } = await loadModules();

    // Create a managed marker first
    addMarker({ lat: 0, lng: 0, title: 'Mine' });

    const { result } = renderHook(() => usePluginMarkers());

    expect(result.current).toHaveLength(1);
    expect(result.current[0]!.uid).toBe('managed-1');
  });

  it('updates when managed marker appears in stream', async () => {
    window._atak = createMockBridge({
      addMarker: () => 'pm-1',
    });

    const { addMarker, usePluginMarkers } = await loadModules();
    addMarker({ lat: 0, lng: 0, title: 'Test' });

    const { result } = renderHook(() => usePluginMarkers());
    expect(result.current).toHaveLength(0);

    act(() => {
      emitFromNative('mapItemsChanged', {
        added: [makeMapItem({ uid: 'pm-1' })],
        removed: [],
        updated: [],
      });
    });

    expect(result.current).toHaveLength(1);
  });
});
