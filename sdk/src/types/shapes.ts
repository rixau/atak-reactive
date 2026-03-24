import type { GeoPoint } from './common';

export interface ShapeOptions {
  points: GeoPoint[];
  closed?: boolean;
  title?: string;
  strokeColor?: string;
  fillColor?: string;
  strokeWeight?: number;
  editable?: boolean;
  archive?: boolean;
  uid?: string;
}

export interface CircleOptions {
  center: GeoPoint;
  radius: number;
  title?: string;
  strokeColor?: string;
  fillColor?: string;
  rings?: number;
  editable?: boolean;
  archive?: boolean;
  uid?: string;
}

export interface EllipseOptions {
  center: GeoPoint;
  width: number;
  length: number;
  angle?: number;
  title?: string;
  strokeColor?: string;
  fillColor?: string;
  editable?: boolean;
  archive?: boolean;
  uid?: string;
}

export interface RectangleOptions {
  points: [GeoPoint, GeoPoint, GeoPoint, GeoPoint];
  title?: string;
  strokeColor?: string;
  fillColor?: string;
  editable?: boolean;
  archive?: boolean;
  uid?: string;
}

export interface ShapeUpdateOptions {
  points?: GeoPoint[];
  closed?: boolean;
  title?: string;
  strokeColor?: string;
  fillColor?: string;
  strokeWeight?: number;
  center?: GeoPoint;
  radius?: number;
  rings?: number;
  width?: number;
  length?: number;
  angle?: number;
}
