export interface GeoPoint {
  lat: number;
  lng: number;
  alt?: number;
}

export interface SelfLocation extends GeoPoint {
  bearing: number;
  speed: number;
}

export interface MarkerOptions {
  lat: number;
  lng: number;
  title: string;
  type?: string;
  uid?: string;
}

export interface MarkerUpdateOptions {
  lat?: number;
  lng?: number;
  title?: string;
  type?: string;
}

export interface MapClickEvent {
  lat: number;
  lng: number;
}

export interface ItemSelectedEvent {
  uid: string;
  type: string;
  title: string;
  lat?: number;
  lng?: number;
}

export type AtakEventMap = {
  selfLocationChanged: SelfLocation;
  mapClick: MapClickEvent;
  mapLongPress: MapClickEvent;
  itemSelected: ItemSelectedEvent;
};

export type AtakEventName = keyof AtakEventMap;

/** Raw bridge interface exposed by Java via @JavascriptInterface */
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
}

declare global {
  interface Window {
    _atak?: NativeBridge;
    __atakBridge?: {
      emit(event: string, data: unknown): void;
    };
  }
}
