import type { GeoPoint } from './common';

export type RouteMethod =
  | 'Driving'
  | 'Walking'
  | 'Flying'
  | 'Swimming'
  | 'Watercraft';

export type RouteDirection = 'Infil' | 'Exfil';

export interface RouteOptions {
  waypoints: GeoPoint[];
  title?: string;
  color?: string;
  prefix?: string;
  method?: RouteMethod;
  direction?: RouteDirection;
  uid?: string;
}

export interface RouteUpdateOptions {
  title?: string;
  color?: string;
  method?: RouteMethod;
  direction?: RouteDirection;
}

export interface WaypointOptions {
  lat: number;
  lng: number;
  alt?: number;
  index?: number;
  title?: string;
}

export interface NavigationState {
  active: boolean;
  routeUid: string | null;
  currentWaypointIndex: number;
  gpsLost: boolean;
}
