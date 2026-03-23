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

  getMapItemsSnapshot() {
    console.log('[atak mock] getMapItemsSnapshot');
    return '[]';
  },

  getMapItem(uid: string) {
    console.log('[atak mock] getMapItem:', uid);
    return 'null';
  },

  getMapGroups() {
    console.log('[atak mock] getMapGroups');
    return '[]';
  },

  getPluginMarkers() {
    console.log('[atak mock] getPluginMarkers');
    return '[]';
  },

  startCotStream() {
    console.log('[atak mock] startCotStream');
  },

  stopCotStream() {
    console.log('[atak mock] stopCotStream');
  },

  sendCot(_cotJson: string, dispatch: string) {
    console.log('[atak mock] sendCot:', dispatch);
    return 'true';
  },

  sendCotToContacts(_cotJson: string, _contactUidsJson: string) {
    console.log('[atak mock] sendCotToContacts');
    return 'true';
  },

  registerAction(action: string) {
    console.log('[atak mock] registerAction:', action);
  },

  unregisterAction(action: string) {
    console.log('[atak mock] unregisterAction:', action);
  },

  sendBroadcast(action: string, extrasJson: string) {
    console.log('[atak mock] sendBroadcast:', action, extrasJson);
  },

  toMGRS(_lat: number, _lng: number) {
    return '18SUJ2337106519';
  },

  toUTM(_lat: number, _lng: number) {
    return '18S 323371 4306519';
  },

  fromMGRS(_mgrs: string) {
    return JSON.stringify({ lat: 38.8977, lng: -77.0365 });
  },

  fromUTM(_utm: string) {
    return JSON.stringify({ lat: 38.8977, lng: -77.0365 });
  },

  getCoordinateFormat() {
    return 'dd';
  },

  formatCoordinate(lat: number, lng: number) {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  },

  distanceTo(_lat1: number, _lng1: number, _lat2: number, _lng2: number) {
    return JSON.stringify({ distance: 0, bearing: 0 });
  },

  startMapItemStream() {
    console.log('[atak mock] startMapItemStream');
  },

  stopMapItemStream() {
    console.log('[atak mock] stopMapItemStream');
  },

  setItemMeta(uid: string, key: string, value: string) {
    console.log('[atak mock] setItemMeta:', uid, key, value);
    return 'true';
  },

  setItemMetaDouble(uid: string, key: string, value: number) {
    console.log('[atak mock] setItemMetaDouble:', uid, key, value);
    return 'true';
  },

  setItemMetaBool(uid: string, key: string, value: boolean) {
    console.log('[atak mock] setItemMetaBool:', uid, key, value);
    return 'true';
  },

  getItemMeta(uid: string, key: string) {
    console.log('[atak mock] getItemMeta:', uid, key);
    return 'null';
  },
};
