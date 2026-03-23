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
}

declare global {
  interface Window {
    _atak?: NativeBridge;
    __atakBridge?: {
      emit(event: string, data: unknown): void;
    };
  }
}
