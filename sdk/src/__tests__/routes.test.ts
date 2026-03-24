import { describe, it, expect, vi } from 'vitest';
import { createMockBridge } from './setup';

async function loadModules() {
  return await import('../bridge/routes');
}

describe('addRoute', () => {
  it('calls bridge.addRoute with waypoints and options', async () => {
    const spy = vi.fn(() => 'route-uid-1');
    window._atak = createMockBridge({ addRoute: spy });
    const { addRoute } = await loadModules();

    const opts = {
      waypoints: [
        { lat: 38.88, lng: -77.03 },
        { lat: 38.89, lng: -77.02 },
        { lat: 38.9, lng: -77.01 },
      ],
      title: 'Patrol Route',
      method: 'Driving' as const,
      direction: 'Infil' as const,
    };
    const uid = addRoute(opts);

    expect(spy).toHaveBeenCalledWith(JSON.stringify(opts));
    expect(uid).toBe('route-uid-1');
  });

  it('returns null when bridge returns null', async () => {
    window._atak = createMockBridge({ addRoute: () => 'null' });
    const { addRoute } = await loadModules();

    expect(addRoute({ waypoints: [{ lat: 0, lng: 0 }] })).toBeNull();
  });

  it('tracks uid in managed set', async () => {
    window._atak = createMockBridge({ addRoute: () => 'tracked-r1' });
    const { addRoute, getManagedRouteUids } = await loadModules();

    addRoute({ waypoints: [{ lat: 0, lng: 0 }] });
    expect(getManagedRouteUids().has('tracked-r1')).toBe(true);
  });
});

describe('updateRoute', () => {
  it('calls bridge.updateRoute with uid and partial options', async () => {
    const spy = vi.fn(() => 'true');
    window._atak = createMockBridge({ updateRoute: spy });
    const { updateRoute } = await loadModules();

    const result = updateRoute('route-1', { title: 'Updated' });

    expect(spy).toHaveBeenCalledWith(
      'route-1',
      JSON.stringify({ title: 'Updated' }),
    );
    expect(result).toBe(true);
  });

  it('returns false when bridge returns false', async () => {
    window._atak = createMockBridge({ updateRoute: () => 'false' });
    const { updateRoute } = await loadModules();

    expect(updateRoute('bad', {})).toBe(false);
  });
});

describe('addWaypoint', () => {
  it('calls bridge.addWaypoint with routeUid and options', async () => {
    const spy = vi.fn(() => 'true');
    window._atak = createMockBridge({ addWaypoint: spy });
    const { addWaypoint } = await loadModules();

    const opts = { lat: 38.91, lng: -77.0, index: 1, title: 'WP4' };
    const result = addWaypoint('route-1', opts);

    expect(spy).toHaveBeenCalledWith('route-1', JSON.stringify(opts));
    expect(result).toBe(true);
  });
});

describe('removeWaypoint', () => {
  it('calls bridge.removeWaypoint with routeUid and waypointUid', async () => {
    const spy = vi.fn(() => 'true');
    window._atak = createMockBridge({ removeWaypoint: spy });
    const { removeWaypoint } = await loadModules();

    expect(removeWaypoint('route-1', 'wp-2')).toBe(true);
    expect(spy).toHaveBeenCalledWith('route-1', 'wp-2');
  });
});

describe('removeRoute', () => {
  it('calls bridge.removeRoute and removes from managed set', async () => {
    const spy = vi.fn(() => 'true');
    window._atak = createMockBridge({
      addRoute: () => 'to-remove-r',
      removeRoute: spy,
    });
    const { addRoute, removeRoute, getManagedRouteUids } =
      await loadModules();

    addRoute({ waypoints: [{ lat: 0, lng: 0 }] });
    expect(getManagedRouteUids().has('to-remove-r')).toBe(true);

    const result = removeRoute('to-remove-r');
    expect(spy).toHaveBeenCalledWith('to-remove-r');
    expect(result).toBe(true);
    expect(getManagedRouteUids().has('to-remove-r')).toBe(false);
  });
});

describe('startNavigation', () => {
  it('calls bridge.startNavigation with routeUid and options', async () => {
    const spy = vi.fn(() => 'true');
    window._atak = createMockBridge({ startNavigation: spy });
    const { startNavigation } = await loadModules();

    expect(startNavigation('route-1', { startIndex: 2 })).toBe(true);
    expect(spy).toHaveBeenCalledWith(
      'route-1',
      JSON.stringify({ startIndex: 2 }),
    );
  });

  it('defaults to empty options when none provided', async () => {
    const spy = vi.fn(() => 'true');
    window._atak = createMockBridge({ startNavigation: spy });
    const { startNavigation } = await loadModules();

    startNavigation('route-1');
    expect(spy).toHaveBeenCalledWith('route-1', '{}');
  });
});

describe('stopNavigation', () => {
  it('calls bridge.stopNavigation', async () => {
    const spy = vi.fn(() => 'true');
    window._atak = createMockBridge({ stopNavigation: spy });
    const { stopNavigation } = await loadModules();

    expect(stopNavigation()).toBe(true);
    expect(spy).toHaveBeenCalled();
  });
});

describe('getPluginRoutes', () => {
  it('returns parsed array from bridge', async () => {
    const items = [{ uid: 'r1', type: 'b-m-r' }];
    window._atak = createMockBridge({
      getPluginRoutes: () => JSON.stringify(items),
    });
    const { getPluginRoutes } = await loadModules();

    expect(getPluginRoutes()).toEqual(items);
  });

  it('returns empty array when bridge returns []', async () => {
    window._atak = createMockBridge();
    const { getPluginRoutes } = await loadModules();

    expect(getPluginRoutes()).toEqual([]);
  });
});

describe('getNavigationState', () => {
  it('returns parsed state from bridge', async () => {
    const state = {
      active: true,
      routeUid: 'r-1',
      currentWaypointIndex: 2,
      gpsLost: false,
    };
    window._atak = createMockBridge({
      getNavigationState: () => JSON.stringify(state),
    });
    const { getNavigationState } = await loadModules();

    expect(getNavigationState()).toEqual(state);
  });

  it('returns inactive default from mock bridge', async () => {
    window._atak = createMockBridge();
    const { getNavigationState } = await loadModules();

    expect(getNavigationState()).toEqual({
      active: false,
      routeUid: null,
      currentWaypointIndex: -1,
      gpsLost: false,
    });
  });
});
