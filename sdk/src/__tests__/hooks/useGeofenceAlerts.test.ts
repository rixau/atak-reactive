import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createMockBridge } from '../setup';
import { makeGeofenceAlert, emitFromNative } from '../helpers';

async function loadModules() {
  return import('../../index');
}

describe('useGeofenceAlerts', () => {
  it('starts empty', async () => {
    window._atak = createMockBridge();
    const { useGeofenceAlerts } = await loadModules();
    const { result } = renderHook(() => useGeofenceAlerts());
    expect(result.current).toHaveLength(0);
  });

  it('accumulates alerts from events', async () => {
    window._atak = createMockBridge();
    const { useGeofenceAlerts } = await loadModules();
    const { result } = renderHook(() => useGeofenceAlerts());

    act(() => {
      emitFromNative('geofenceAlert', makeGeofenceAlert({ entered: true }));
    });
    expect(result.current).toHaveLength(1);
    expect(result.current[0].entered).toBe(true);

    act(() => {
      emitFromNative('geofenceAlert', makeGeofenceAlert({ entered: false }));
    });
    expect(result.current).toHaveLength(2);
  });

  it('filters by fenceUid when provided', async () => {
    window._atak = createMockBridge();
    const { useGeofenceAlerts } = await loadModules();
    const { result } = renderHook(() => useGeofenceAlerts('fence-A'));

    act(() => {
      emitFromNative('geofenceAlert', makeGeofenceAlert({ fenceUid: 'fence-A' }));
      emitFromNative('geofenceAlert', makeGeofenceAlert({ fenceUid: 'fence-B' }));
    });

    expect(result.current).toHaveLength(1);
    expect(result.current[0].fenceUid).toBe('fence-A');
  });

  it('cleans up on unmount', async () => {
    window._atak = createMockBridge();
    const { useGeofenceAlerts } = await loadModules();
    const { result, unmount } = renderHook(() => useGeofenceAlerts());

    act(() => {
      emitFromNative('geofenceAlert', makeGeofenceAlert());
    });
    expect(result.current).toHaveLength(1);

    unmount();
    // No error, clean unmount
  });
});
