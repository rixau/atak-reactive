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
  setPreference,
  removePreference,
  getManagedUids,
} from './bridge';

// Dropdown / nav
export {
  setDropdownSize,
  getDropdownSize,
  setNavVisible,
  getNavVisible,
  type DropdownDimension,
} from './dropdown';

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
  setMarkerIcon,
} from './mapItems';

// Map group management
export { createMapGroup, removeMapGroup, setGroupVisible } from './mapGroups';

// Shape CRUD
export {
  addShape,
  addCircle,
  addEllipse,
  addRectangle,
  updateShape,
  removeShape,
  getManagedShapeUids,
  getPluginShapes,
} from './shapes';

// Route CRUD + navigation
export {
  addRoute,
  updateRoute,
  addWaypoint,
  removeWaypoint,
  removeRoute,
  startNavigation,
  stopNavigation,
  getManagedRouteUids,
  getPluginRoutes,
  getNavigationState,
  onNavigationStateChanged,
} from './routes';

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
  useDropdownVisible,
  useDropdownSize,
  useNavVisible,
  usePreference,
  useMenuAction,
  useNavigationState,
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
  MarkerIconOptions,
  MenuActionEvent,
  ShapeOptions,
  CircleOptions,
  EllipseOptions,
  RectangleOptions,
  ShapeUpdateOptions,
  RouteOptions,
  RouteUpdateOptions,
  WaypointOptions,
  NavigationState,
  RouteMethod,
  RouteDirection,
} from './types';
