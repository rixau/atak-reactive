import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createMockBridge } from './setup';
import { makeMapItem, emitFromNative } from './helpers';

function loadModules() {
  return import('../index');
}

describe('marker icons', () => {
  it('setMarkerIcon calls bridge with correct args', async () => {
    const setIconFn = vi.fn(() => 'true');
    window._atak = createMockBridge({ setMarkerIcon: setIconFn });

    const { setMarkerIcon } = await loadModules();
    const result = setMarkerIcon('uid-1', {
      iconUri: 'android.resource://com.example/drawable/icon',
      iconColor: 0xFF0000,
    });

    expect(setIconFn).toHaveBeenCalledWith(
      'uid-1',
      JSON.stringify({
        iconUri: 'android.resource://com.example/drawable/icon',
        iconColor: 0xFF0000,
      }),
    );
    expect(result).toBe(true);
  });

  it('setMarkerIcon returns false when marker not found', async () => {
    window._atak = createMockBridge({ setMarkerIcon: () => 'false' });

    const { setMarkerIcon } = await loadModules();
    expect(setMarkerIcon('nonexistent', { iconUri: 'base64://abc' })).toBe(false);
  });

  it('iconUri flows through MapItemStore reactive updates', async () => {
    const item = makeMapItem({ uid: 'icon-test', iconUri: null });
    window._atak = createMockBridge({
      getMapItemsSnapshot: () => JSON.stringify([item]),
    });

    const { useMapItems } = await loadModules();
    const { result } = renderHook(() => useMapItems());

    expect(result.current).toHaveLength(1);
    expect(result.current[0]!.iconUri).toBeNull();

    act(() => {
      emitFromNative('mapItemsChanged', {
        added: [],
        removed: [],
        updated: [makeMapItem({
          uid: 'icon-test',
          iconUri: 'base64://abc123',
        })],
      });
    });

    expect(result.current[0]!.iconUri).toBe('base64://abc123');
  });

  it('addMarker passes iconUri and group through to bridge', async () => {
    const addFn = vi.fn(() => 'test-uid');
    window._atak = createMockBridge({ addMarker: addFn });

    const { addMarker } = await loadModules();
    addMarker({
      lat: 38.8977,
      lng: -77.0365,
      title: 'Custom Icon',
      iconUri: 'android.resource://com.example/drawable/tank',
      iconColor: 0x00FF00,
      group: 'My Layer',
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const passedJson = (addFn.mock.calls as any)[0][0] as string;
    const parsed = JSON.parse(passedJson);
    expect(parsed.iconUri).toBe('android.resource://com.example/drawable/tank');
    expect(parsed.iconColor).toBe(0x00FF00);
    expect(parsed.group).toBe('My Layer');
  });
});
