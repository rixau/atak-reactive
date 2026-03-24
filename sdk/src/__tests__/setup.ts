import { beforeEach } from 'vitest';
import type { NativeBridge } from '../types';
import { mapItemStore } from '../MapItemStore';
import { cotStore } from '../cot';

export function createMockBridge(overrides?: Partial<NativeBridge>): NativeBridge {
  return {
    getSelfLocation: () => 'null',
    getMapCenter: () => 'null',
    addMarker: () => 'null',
    updateMarker: () => 'false',
    removeMarker: () => 'false',
    panTo: () => {},
    getPreference: () => 'null',
    subscribe: () => {},
    unsubscribe: () => {},
    getMapItemsSnapshot: () => '[]',
    getMapItem: () => 'null',
    getMapGroups: () => '[]',
    getPluginMarkers: () => '[]',
    startCotStream: () => {},
    stopCotStream: () => {},
    sendCot: () => 'true',
    sendCotToContacts: () => 'true',
    registerAction: () => {},
    unregisterAction: () => {},
    sendBroadcast: () => {},
    toMGRS: () => '18SUJ2337106519',
    toUTM: () => '18S 323371 4306519',
    fromMGRS: () => JSON.stringify({ lat: 38.8977, lng: -77.0365 }),
    fromUTM: () => JSON.stringify({ lat: 38.8977, lng: -77.0365 }),
    getCoordinateFormat: () => 'dd',
    formatCoordinate: (lat: number, lng: number) => `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    distanceTo: () => JSON.stringify({ distance: 1000, bearing: 45 }),
    startMapItemStream: () => {},
    stopMapItemStream: () => {},
    setItemMeta: () => 'true',
    setItemMetaDouble: () => 'true',
    setItemMetaBool: () => 'true',
    getItemMeta: () => 'null',
    setPreference: () => 'true',
    removePreference: () => 'true',
    setDropdownSize: () => {},
    getDropdownSize: () => '{"width":0.5,"height":1.0}',
    setNavVisible: () => {},
    getNavVisible: () => 'true',
    setMarkerIcon: () => 'true',
    createMapGroup: () => 'true',
    removeMapGroup: () => 'true',
    setGroupVisible: () => 'true',
    // Shapes
    addShape: () => 'null',
    addCircle: () => 'null',
    addEllipse: () => 'null',
    addRectangle: () => 'null',
    updateShape: () => 'false',
    removeShape: () => 'false',
    getPluginShapes: () => '[]',
    // Routes
    addRoute: () => 'null',
    updateRoute: () => 'false',
    addWaypoint: () => 'false',
    removeWaypoint: () => 'false',
    removeRoute: () => 'false',
    getPluginRoutes: () => '[]',
    // Navigation
    startNavigation: () => 'false',
    stopNavigation: () => 'false',
    getNavigationState: () =>
      JSON.stringify({
        active: false,
        routeUid: null,
        currentWaypointIndex: -1,
        gpsLost: false,
      }),
    ...overrides,
  };
}

beforeEach(() => {
  mapItemStore.reset();
  cotStore.reset();
  delete window._atak;
});
