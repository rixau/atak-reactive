// Bridge functions
export {
  isNative,
  getSelfLocation,
  getMapCenter,
  addMarker,
  updateMarker,
  removeMarker,
  panTo,
  getPreference,
  getManagedUids,
} from './bridge';

// Map item queries
export {
  getMapItemsSnapshot,
  getMapItem,
  getMapGroups,
  getPluginMarkers,
} from './mapItems';

// Map item store
export { mapItemStore, matchesFilter } from './MapItemStore';

// Event system
export { on, off } from './events';

// React hooks
export {
  useSelfLocation,
  useMapEvent,
  useAtakEvent,
  useMapItems,
  useMapItem,
  useMapGroups,
  usePluginMarkers,
} from './hooks';

// Types
export type {
  GeoPoint,
  SelfLocation,
  MarkerOptions,
  MarkerUpdateOptions,
  MapClickEvent,
  ItemSelectedEvent,
  MapItemData,
  MapItemFilter,
  MapGroupData,
  MapItemsChangedEvent,
  AtakEventName,
  AtakEventMap,
} from './types';
