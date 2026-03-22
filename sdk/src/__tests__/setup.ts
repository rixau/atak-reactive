import { beforeEach } from 'vitest';
import type { NativeBridge } from '../types';
import { mapItemStore } from '../MapItemStore';

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
    startMapItemStream: () => {},
    stopMapItemStream: () => {},
    ...overrides,
  };
}

beforeEach(() => {
  mapItemStore.reset();
  delete window._atak;
});
