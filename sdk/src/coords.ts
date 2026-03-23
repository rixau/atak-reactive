import type { GeoPoint, NativeBridge } from './types';
import { mockBridge } from './mock';

function getBridge(): NativeBridge {
  return window._atak ?? mockBridge;
}

export function toMGRS(lat: number, lng: number): string {
  return getBridge().toMGRS(lat, lng);
}

export function toUTM(lat: number, lng: number): string {
  return getBridge().toUTM(lat, lng);
}

export function fromMGRS(mgrs: string): GeoPoint | null {
  const raw = getBridge().fromMGRS(mgrs);
  if (raw === 'null') return null;
  return JSON.parse(raw) as GeoPoint;
}

export function fromUTM(utm: string): GeoPoint | null {
  const raw = getBridge().fromUTM(utm);
  if (raw === 'null') return null;
  return JSON.parse(raw) as GeoPoint;
}

export type CoordinateFormat = 'dd' | 'dm' | 'dms' | 'mgrs' | 'utm';

export function getCoordinateFormat(): CoordinateFormat {
  return getBridge().getCoordinateFormat() as CoordinateFormat;
}

export function formatCoordinate(lat: number, lng: number): string {
  return getBridge().formatCoordinate(lat, lng);
}

export function distanceTo(
  p1: GeoPoint,
  p2: GeoPoint,
): { distance: number; bearing: number } | null {
  const raw = getBridge().distanceTo(p1.lat, p1.lng, p2.lat, p2.lng);
  if (raw === 'null') return null;
  return JSON.parse(raw) as { distance: number; bearing: number };
}
