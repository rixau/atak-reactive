import type {
  GeoPoint,
  MarkerOptions,
  MarkerUpdateOptions,
  NativeBridge,
  SelfLocation,
} from '../types';
import { mockBridge } from '../mock';

declare const __SDK_VERSION__: string;
export const SDK_VERSION: string = typeof __SDK_VERSION__ !== 'undefined' ? __SDK_VERSION__ : '0.0.0';

let versionChecked = false;

function getBridge(): NativeBridge {
  const bridge = window._atak ?? mockBridge;

  if (!versionChecked) {
    versionChecked = true;
    const bridgeVersion = bridge.getBridgeVersion?.() ?? 'unknown';
    if (bridgeVersion !== SDK_VERSION && bridgeVersion !== 'unknown' && bridgeVersion !== 'mock') {
      console.warn(
        `[atak-reactive] Version mismatch: SDK ${SDK_VERSION}, bridge ${bridgeVersion}. ` +
        `Run 'npx @atak-reactive/cli init' to sync.`,
      );
    }
  }

  return bridge;
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

const managedUids = new Set<string>();

export function addMarker(options: MarkerOptions): string | null {
  const raw = getBridge().addMarker(JSON.stringify(options));
  if (raw === 'null') return null;
  managedUids.add(raw);
  return raw;
}

export function updateMarker(
  uid: string,
  options: MarkerUpdateOptions,
): boolean {
  return getBridge().updateMarker(uid, JSON.stringify(options)) === 'true';
}

export function removeMarker(uid: string): boolean {
  managedUids.delete(uid);
  return getBridge().removeMarker(uid) === 'true';
}

export function getManagedUids(): ReadonlySet<string> {
  return managedUids;
}

export function panTo(lat: number, lng: number, zoom?: number): void {
  getBridge().panTo(lat, lng, zoom ?? 0);
}

export function getPreference(key: string): string | null {
  const raw = getBridge().getPreference(key);
  if (raw === 'null') return null;
  return raw;
}

export function setPreference(key: string, value: string): boolean {
  const raw = getBridge().setPreference(key, value);
  return raw === 'true';
}

export function removePreference(key: string): boolean {
  const raw = getBridge().removePreference(key);
  return raw === 'true';
}
