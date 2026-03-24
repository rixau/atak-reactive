export interface MarkerOptions {
  lat: number;
  lng: number;
  title: string;
  type?: string;
  uid?: string;
  iconUri?: string;
  iconColor?: number;
  group?: string;
}

export interface MarkerUpdateOptions {
  lat?: number;
  lng?: number;
  title?: string;
  type?: string;
  iconUri?: string;
  iconColor?: number;
}

export interface MarkerIconOptions {
  iconUri: string;
  iconColor?: number;
}
