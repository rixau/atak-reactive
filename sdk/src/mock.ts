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
    return localStorage.getItem('mock_pref_' + key) ?? 'null';
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

  setPreference(key: string, value: string) {
    localStorage.setItem('mock_pref_' + key, value);
    console.log('[atak mock] setPreference:', key, value);
    return 'true';
  },

  removePreference(key: string) {
    localStorage.removeItem('mock_pref_' + key);
    console.log('[atak mock] removePreference:', key);
    return 'true';
  },

  setDropdownSize(width: string, height: string) {
    console.log('[atak mock] setDropdownSize:', width, height);
  },

  getDropdownSize() {
    return JSON.stringify({ width: 0.5, height: 1.0 });
  },

  setNavVisible(visible: boolean) {
    console.log('[atak mock] setNavVisible:', visible);
  },

  getNavVisible() {
    return 'true';
  },

  setMarkerIcon(uid: string, optionsJson: string) {
    console.log('[atak mock] setMarkerIcon:', uid, JSON.parse(optionsJson));
    return 'true';
  },

  createMapGroup(name: string, parentName: string) {
    console.log('[atak mock] createMapGroup:', name, parentName || '(root)');
    return 'true';
  },

  removeMapGroup(name: string) {
    console.log('[atak mock] removeMapGroup:', name);
    return 'true';
  },

  setGroupVisible(name: string, visible: string) {
    console.log('[atak mock] setGroupVisible:', name, visible);
    return 'true';
  },

  // Shapes
  addShape(optionsJson: string) {
    const opts = JSON.parse(optionsJson) as Record<string, unknown>;
    const uid =
      (opts['uid'] as string | undefined) ??
      `mock-shape-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    console.log('[atak mock] addShape:', opts, '→ uid:', uid);
    return uid;
  },

  addCircle(optionsJson: string) {
    const opts = JSON.parse(optionsJson) as Record<string, unknown>;
    const uid =
      (opts['uid'] as string | undefined) ??
      `mock-circle-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    console.log('[atak mock] addCircle:', opts, '→ uid:', uid);
    return uid;
  },

  addEllipse(optionsJson: string) {
    const opts = JSON.parse(optionsJson) as Record<string, unknown>;
    const uid =
      (opts['uid'] as string | undefined) ??
      `mock-ellipse-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    console.log('[atak mock] addEllipse:', opts, '→ uid:', uid);
    return uid;
  },

  addRectangle(optionsJson: string) {
    const opts = JSON.parse(optionsJson) as Record<string, unknown>;
    const uid =
      (opts['uid'] as string | undefined) ??
      `mock-rect-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    console.log('[atak mock] addRectangle:', opts, '→ uid:', uid);
    return uid;
  },

  updateShape(uid: string, optionsJson: string) {
    console.log('[atak mock] updateShape:', uid, JSON.parse(optionsJson));
    return 'true';
  },

  removeShape(uid: string) {
    console.log('[atak mock] removeShape:', uid);
    return 'true';
  },

  getPluginShapes() {
    console.log('[atak mock] getPluginShapes');
    return '[]';
  },

  // Routes
  addRoute(optionsJson: string) {
    const opts = JSON.parse(optionsJson) as Record<string, unknown>;
    const uid =
      (opts['uid'] as string | undefined) ??
      `mock-route-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    console.log('[atak mock] addRoute:', opts, '→ uid:', uid);
    return uid;
  },

  updateRoute(uid: string, optionsJson: string) {
    console.log('[atak mock] updateRoute:', uid, JSON.parse(optionsJson));
    return 'true';
  },

  addWaypoint(routeUid: string, optionsJson: string) {
    console.log(
      '[atak mock] addWaypoint:',
      routeUid,
      JSON.parse(optionsJson),
    );
    return 'true';
  },

  removeWaypoint(routeUid: string, waypointUid: string) {
    console.log('[atak mock] removeWaypoint:', routeUid, waypointUid);
    return 'true';
  },

  removeRoute(uid: string) {
    console.log('[atak mock] removeRoute:', uid);
    return 'true';
  },

  getPluginRoutes() {
    console.log('[atak mock] getPluginRoutes');
    return '[]';
  },

  // Navigation
  startNavigation(routeUid: string, optionsJson: string) {
    console.log(
      '[atak mock] startNavigation:',
      routeUid,
      JSON.parse(optionsJson),
    );
    return 'true';
  },

  stopNavigation() {
    console.log('[atak mock] stopNavigation');
    return 'true';
  },

  getNavigationState() {
    return JSON.stringify({
      active: false,
      routeUid: null,
      currentWaypointIndex: -1,
      gpsLost: false,
    });
  },

  // Contacts
  subscribeContacts() {
    console.log('[atak mock] subscribeContacts');
  },

  unsubscribeContacts() {
    console.log('[atak mock] unsubscribeContacts');
  },

  // Chat
  subscribeChat() {
    console.log('[atak mock] subscribeChat');
  },

  unsubscribeChat() {
    console.log('[atak mock] unsubscribeChat');
  },

  sendChatMessage(conversationId: string, text: string) {
    console.log('[atak mock] sendChatMessage:', conversationId, text);
  },

  getChatHistory(_conversationId: string, _limit: number) {
    return '[]';
  },

  getConversations() {
    return '[]';
  },

  openConversation(contactUid: string) {
    console.log('[atak mock] openConversation:', contactUid);
  },

  // Geofence
  createGeofence(_optionsJson: string) {
    return 'true';
  },

  removeGeofence(_shapeUid: string) {
    console.log('[atak mock] removeGeofence');
  },

  dismissGeofenceAlert(_fenceUid: string, _itemUid: string) {
    console.log('[atak mock] dismissGeofenceAlert');
  },
};
