import type {
  GeoPoint,
  MarkerOptions,
  MarkerUpdateOptions,
  NativeBridge,
  SelfLocation,
} from './types';
import { mockBridge } from './mock';

function getBridge(): NativeBridge {
  return window._atak ?? mockBridge;
}

export function isNative(): boolean {
  return typeof window._atak !== 'undefined';
}

export function getSelfLocation(): SelfLocation | null {
  const raw = getBridge().getSelfLocation();
  if (raw === 'null') return null;
  return JSON.parse(raw) as SelfLocation;
}

export function getMapCenter(): GeoPoint | null {
  const raw = getBridge().getMapCenter();
  if (raw === 'null') return null;
  return JSON.parse(raw) as GeoPoint;
}

export function addMarker(options: MarkerOptions): string | null {
  const raw = getBridge().addMarker(JSON.stringify(options));
  if (raw === 'null') return null;
  return raw;
}

export function updateMarker(
  uid: string,
  options: MarkerUpdateOptions,
): boolean {
  return getBridge().updateMarker(uid, JSON.stringify(options)) === 'true';
}

export function removeMarker(uid: string): boolean {
  return getBridge().removeMarker(uid) === 'true';
}

export function panTo(lat: number, lng: number, zoom?: number): void {
  getBridge().panTo(lat, lng, zoom ?? 0);
}

export function getPreference(key: string): string | null {
  const raw = getBridge().getPreference(key);
  if (raw === 'null') return null;
  return raw;
}
