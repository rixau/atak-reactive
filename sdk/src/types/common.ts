export interface GeoPoint {
  lat: number;
  lng: number;
  alt?: number;
}

export interface SelfLocation extends GeoPoint {
  bearing: number;
  speed: number;
}
