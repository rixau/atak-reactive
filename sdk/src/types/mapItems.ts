import type { GeoPoint } from './common';

export interface MapItemData {
  uid: string;
  type: string;
  title: string;
  lat: number | null;
  lng: number | null;
  alt: number | null;
  visible: boolean;
  group: string | null;
  callsign: string;
  team: string;
  speed: number;
  bearing: number;
  remarks: string;
  how: string;
  editable: boolean;
  movable: boolean;
  iconUri: string | null;

  // Shape fields (present when item is a shape)
  points?: GeoPoint[];
  closed?: boolean;
  strokeColor?: string;
  fillColor?: string;
  strokeWeight?: number;
  radius?: number;
  rings?: number;
  width?: number;
  length?: number;
  angle?: number;

  // Route fields (present when item is a route)
  routeMethod?: string;
  routeDirection?: string;
  routeType?: string;
}

export interface MapItemFilter {
  type?: string;
  group?: string;
  visible?: boolean;
  meta?: Record<string, string>;
}

export interface MapGroupData {
  name: string;
  childGroups: MapGroupData[];
  itemCount: number;
}

export interface MapItemsChangedEvent {
  added: MapItemData[];
  removed: string[];
  updated: MapItemData[];
}
