import type { NativeBridge } from './types';

/** Mock bridge for browser-only development (no Android device) */
export const mockBridge: NativeBridge = {
  getSelfLocation() {
    return JSON.stringify({
      lat: 38.8977,
      lng: -77.0365,
      alt: 15.0,
      bearing: 45.0,
      speed: 0.0,
    });
  },

  getMapCenter() {
    return JSON.stringify({ lat: 38.8977, lng: -77.0365 });
  },

  addMarker(optionsJson: string) {
    const opts = JSON.parse(optionsJson) as Record<string, unknown>;
    const uid =
      (opts['uid'] as string | undefined) ??
      `mock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    console.log('[atak mock] addMarker:', opts, '→ uid:', uid);
    return uid;
  },

  updateMarker(uid: string, optionsJson: string) {
    console.log(
      '[atak mock] updateMarker:',
      uid,
      JSON.parse(optionsJson),
    );
    return 'true';
  },

  removeMarker(uid: string) {
    console.log('[atak mock] removeMarker:', uid);
    return 'true';
  },

  panTo(lat: number, lng: number, zoom: number) {
    console.log('[atak mock] panTo:', { lat, lng, zoom });
  },

  getPreference(key: string) {
    console.log('[atak mock] getPreference:', key);
    return 'null';
  },

  subscribe(eventName: string) {
    console.log('[atak mock] subscribe:', eventName);
  },

  unsubscribe(eventName: string) {
    console.log('[atak mock] unsubscribe:', eventName);
  },
};
