export interface NativeBridge {
  getSelfLocation(): string;
  getMapCenter(): string;
  addMarker(optionsJson: string): string;
  updateMarker(uid: string, optionsJson: string): string;
  removeMarker(uid: string): string;
  panTo(lat: number, lng: number, zoom: number): void;
  getPreference(key: string): string;
  subscribe(eventName: string): void;
  unsubscribe(eventName: string): void;
  getMapItemsSnapshot(): string;
  getMapItem(uid: string): string;
  getMapGroups(): string;
  getPluginMarkers(): string;
  startMapItemStream(): void;
  stopMapItemStream(): void;
  startCotStream(): void;
  stopCotStream(): void;
  sendCot(cotJson: string, dispatch: string): string;
  sendCotToContacts(cotJson: string, contactUidsJson: string): string;
  registerAction(action: string): void;
  unregisterAction(action: string): void;
  sendBroadcast(action: string, extrasJson: string): void;
  toMGRS(lat: number, lng: number): string;
  toUTM(lat: number, lng: number): string;
  fromMGRS(mgrs: string): string;
  fromUTM(utm: string): string;
  getCoordinateFormat(): string;
  formatCoordinate(lat: number, lng: number): string;
  distanceTo(lat1: number, lng1: number, lat2: number, lng2: number): string;
  setItemMeta(uid: string, key: string, value: string): string;
  setItemMetaDouble(uid: string, key: string, value: number): string;
  setItemMetaBool(uid: string, key: string, value: boolean): string;
  getItemMeta(uid: string, key: string): string;
  setPreference(key: string, value: string): string;
  removePreference(key: string): string;
  setDropdownSize(width: string, height: string): void;
  getDropdownSize(): string;
  setNavVisible(visible: boolean): void;
  getNavVisible(): string;
  setMarkerIcon(uid: string, optionsJson: string): string;
  createMapGroup(name: string, parentName: string): string;
  removeMapGroup(name: string): string;
  setGroupVisible(name: string, visible: string): string;

  // Shapes
  addShape(optionsJson: string): string;
  addCircle(optionsJson: string): string;
  addEllipse(optionsJson: string): string;
  addRectangle(optionsJson: string): string;
  updateShape(uid: string, optionsJson: string): string;
  removeShape(uid: string): string;
  getPluginShapes(): string;

  // Routes
  addRoute(optionsJson: string): string;
  updateRoute(uid: string, optionsJson: string): string;
  addWaypoint(routeUid: string, optionsJson: string): string;
  removeWaypoint(routeUid: string, waypointUid: string): string;
  removeRoute(uid: string): string;
  getPluginRoutes(): string;

  // Navigation
  startNavigation(routeUid: string, optionsJson: string): string;
  stopNavigation(): string;
  getNavigationState(): string;
}

declare global {
  interface Window {
    _atak?: NativeBridge;
    __atakBridge?: {
      emit(event: string, data: unknown): void;
    };
  }
}
