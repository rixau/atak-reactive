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
}

declare global {
  interface Window {
    _atak?: NativeBridge;
    __atakBridge?: {
      emit(event: string, data: unknown): void;
    };
  }
}
