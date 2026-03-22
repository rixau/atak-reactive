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
