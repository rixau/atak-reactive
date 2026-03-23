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

// Map item queries and metadata
export {
  getMapItemsSnapshot,
  getMapItem,
  getMapGroups,
  getPluginMarkers,
  setItemMeta,
  setItemMetaDouble,
  setItemMetaBool,
  getItemMeta,
} from './mapItems';

// CoT messaging
export { sendCot, sendCotToContacts, cotStore } from './cot';

// Intent broadcast
export { registerAction, unregisterAction, sendBroadcast } from './intents';

// Coordinate conversions
export {
  toMGRS,
  toUTM,
  fromMGRS,
  fromUTM,
  getCoordinateFormat,
  formatCoordinate,
  distanceTo,
  type CoordinateFormat,
} from './coords';

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
  useCoordinateFormat,
  useIntent,
  useIntentCallback,
  useCotStream,
  useCotEvent,
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
  IntentData,
  CotEventData,
  CotDispatchTarget,
} from './types';
