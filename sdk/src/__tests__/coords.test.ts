import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createMockBridge } from './setup';

function loadModules() {
  return import('../index');
}

describe('coordinate conversions', () => {
  it('toMGRS calls bridge and returns string', async () => {
    const toMGRSFn = vi.fn(() => '18SUJ2337106519');
    window._atak = createMockBridge({ toMGRS: toMGRSFn });

    const { toMGRS } = await loadModules();
    const result = toMGRS(38.8977, -77.0365);

    expect(toMGRSFn).toHaveBeenCalledWith(38.8977, -77.0365);
    expect(result).toBe('18SUJ2337106519');
  });

  it('toUTM calls bridge and returns string', async () => {
    const toUTMFn = vi.fn(() => '18S 323371 4306519');
    window._atak = createMockBridge({ toUTM: toUTMFn });

    const { toUTM } = await loadModules();
    expect(toUTM(38.8977, -77.0365)).toBe('18S 323371 4306519');
  });

  it('fromMGRS parses JSON response', async () => {
    window._atak = createMockBridge({
      fromMGRS: () => JSON.stringify({ lat: 38.8977, lng: -77.0365 }),
    });

    const { fromMGRS } = await loadModules();
    const result = fromMGRS('18SUJ2337106519');

    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(38.8977);
    expect(result!.lng).toBeCloseTo(-77.0365);
  });

  it('fromMGRS returns null on invalid input', async () => {
    window._atak = createMockBridge({ fromMGRS: () => 'null' });

    const { fromMGRS } = await loadModules();
    expect(fromMGRS('invalid')).toBeNull();
  });

  it('fromUTM parses JSON response', async () => {
    window._atak = createMockBridge({
      fromUTM: () => JSON.stringify({ lat: 38.8977, lng: -77.0365 }),
    });

    const { fromUTM } = await loadModules();
    const result = fromUTM('18S 323371 4306519');
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(38.8977);
  });

  it('distanceTo returns distance and bearing', async () => {
    window._atak = createMockBridge({
      distanceTo: () => JSON.stringify({ distance: 1500.5, bearing: 90.2 }),
    });

    const { distanceTo } = await loadModules();
    const result = distanceTo({ lat: 38, lng: -77 }, { lat: 39, lng: -76 });

    expect(result).not.toBeNull();
    expect(result!.distance).toBeCloseTo(1500.5);
    expect(result!.bearing).toBeCloseTo(90.2);
  });

  it('formatCoordinate returns formatted string', async () => {
    const formatFn = vi.fn(() => '38.897700, -77.036500');
    window._atak = createMockBridge({ formatCoordinate: formatFn });

    const { formatCoordinate } = await loadModules();
    expect(formatCoordinate(38.8977, -77.0365)).toBe('38.897700, -77.036500');
  });

  it('getCoordinateFormat returns format string', async () => {
    window._atak = createMockBridge({ getCoordinateFormat: () => 'mgrs' });

    const { getCoordinateFormat } = await loadModules();
    expect(getCoordinateFormat()).toBe('mgrs');
  });

  it('useCoordinateFormat hook returns format on mount', async () => {
    window._atak = createMockBridge({ getCoordinateFormat: () => 'utm' });

    const { useCoordinateFormat } = await loadModules();
    const { result } = renderHook(() => useCoordinateFormat());

    expect(result.current).toBe('utm');
  });
});
