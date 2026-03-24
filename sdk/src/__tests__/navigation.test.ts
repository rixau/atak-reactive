import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createMockBridge } from './setup';
import { emitFromNative, makeNavState } from './helpers';

async function loadHook() {
  const { useNavigationState } = await import('../hooks/useNavigationState');
  return useNavigationState;
}

async function loadFunctions() {
  return await import('../routes');
}

describe('onNavigationStateChanged', () => {
  it('calls callback when navigationStateChanged fires', async () => {
    window._atak = createMockBridge();
    // Ensure event system is initialized
    await import('../events');
    const { onNavigationStateChanged } = await loadFunctions();

    const states: unknown[] = [];
    const unsub = onNavigationStateChanged((s) => states.push(s));

    const navState = makeNavState({
      active: true,
      routeUid: 'r-1',
      currentWaypointIndex: 0,
    });
    emitFromNative('navigationStateChanged', navState);

    expect(states).toHaveLength(1);
    expect(states[0]).toEqual(navState);

    unsub();

    emitFromNative('navigationStateChanged', makeNavState());
    expect(states).toHaveLength(1); // no more callbacks after unsub
  });
});

describe('useNavigationState', () => {
  it('returns inactive state initially', async () => {
    window._atak = createMockBridge();
    await import('../events');
    const useNavigationState = await loadHook();

    const { result } = renderHook(() => useNavigationState());

    expect(result.current).toEqual({
      active: false,
      routeUid: null,
      currentWaypointIndex: -1,
      gpsLost: false,
    });
  });

  it('updates when navigationStateChanged event fires', async () => {
    window._atak = createMockBridge();
    await import('../events');
    const useNavigationState = await loadHook();

    const { result } = renderHook(() => useNavigationState());

    act(() => {
      emitFromNative('navigationStateChanged', {
        active: true,
        routeUid: 'route-1',
        currentWaypointIndex: 0,
        gpsLost: false,
      });
    });

    expect(result.current.active).toBe(true);
    expect(result.current.routeUid).toBe('route-1');
    expect(result.current.currentWaypointIndex).toBe(0);
  });

  it('reflects waypoint index changes during navigation', async () => {
    window._atak = createMockBridge();
    await import('../events');
    const useNavigationState = await loadHook();

    const { result } = renderHook(() => useNavigationState());

    act(() => {
      emitFromNative(
        'navigationStateChanged',
        makeNavState({
          active: true,
          routeUid: 'r-1',
          currentWaypointIndex: 0,
        }),
      );
    });
    expect(result.current.currentWaypointIndex).toBe(0);

    act(() => {
      emitFromNative(
        'navigationStateChanged',
        makeNavState({
          active: true,
          routeUid: 'r-1',
          currentWaypointIndex: 2,
        }),
      );
    });
    expect(result.current.currentWaypointIndex).toBe(2);
  });

  it('reflects gpsLost state changes', async () => {
    window._atak = createMockBridge();
    await import('../events');
    const useNavigationState = await loadHook();

    const { result } = renderHook(() => useNavigationState());

    act(() => {
      emitFromNative(
        'navigationStateChanged',
        makeNavState({
          active: true,
          routeUid: 'r-1',
          currentWaypointIndex: 1,
          gpsLost: true,
        }),
      );
    });
    expect(result.current.gpsLost).toBe(true);
  });
});
