import type { GeofenceOptions, NativeBridge } from '../types';
import { mockBridge } from '../mock';

function getBridge(): NativeBridge {
  return window._atak ?? mockBridge;
}

export function createGeofence(options: GeofenceOptions): void {
  getBridge().createGeofence(JSON.stringify(options));
}

export function removeGeofence(shapeUid: string): void {
  getBridge().removeGeofence(shapeUid);
}

export function dismissGeofenceAlert(fenceUid: string, itemUid: string): void {
  getBridge().dismissGeofenceAlert(fenceUid, itemUid);
}
