import type {
  MapItemData,
  CotEventData,
  MenuActionEvent,
  NavigationState,
  ContactData,
  ChatMessageData,
  GeofenceAlertData,
} from '../types';

let counter = 0;

export function makeMapItem(overrides?: Partial<MapItemData>): MapItemData {
  counter++;
  return {
    uid: `item-${counter}`,
    type: 'a-f-G',
    title: `Item ${counter}`,
    lat: 38.8977,
    lng: -77.0365,
    alt: 15,
    visible: true,
    group: 'Cursor on Target',
    callsign: '',
    team: '',
    speed: 0,
    bearing: 0,
    remarks: '',
    how: 'h-g-i-g-o',
    editable: true,
    movable: true,
    iconUri: null,
    ...overrides,
  };
}

export function makeCotEvent(overrides?: Partial<CotEventData>): CotEventData {
  counter++;
  return {
    uid: `cot-${counter}`,
    type: 'a-f-G-U-C',
    lat: 38.8977,
    lng: -77.0365,
    alt: 15,
    how: 'm-g',
    time: Date.now(),
    stale: Date.now() + 300000,
    callsign: `UNIT-${counter}`,
    team: 'Cyan',
    detail: {},
    ...overrides,
  };
}

export function makeMenuAction(
  overrides?: Partial<MenuActionEvent>,
): MenuActionEvent {
  counter++;
  return {
    actionId: `action-${counter}`,
    itemUid: `item-${counter}`,
    itemType: 'a-f-G',
    title: `Item ${counter}`,
    ...overrides,
  };
}

export function makeShapeItem(
  overrides?: Partial<MapItemData>,
): MapItemData {
  counter++;
  return {
    uid: `shape-${counter}`,
    type: 'u-d-f',
    title: `Shape ${counter}`,
    lat: 38.8977,
    lng: -77.0365,
    alt: null,
    visible: true,
    group: 'Drawing Objects',
    callsign: '',
    team: '',
    speed: 0,
    bearing: 0,
    remarks: '',
    how: 'h-g-i-g-o',
    editable: true,
    movable: true,
    iconUri: null,
    points: [
      { lat: 38.897, lng: -77.036 },
      { lat: 38.898, lng: -77.035 },
      { lat: 38.897, lng: -77.034 },
    ],
    closed: true,
    strokeColor: '#FFFF0000',
    fillColor: '#3300FF00',
    strokeWeight: 2,
    ...overrides,
  };
}

export function makeCircleItem(
  overrides?: Partial<MapItemData>,
): MapItemData {
  counter++;
  return {
    uid: `circle-${counter}`,
    type: 'u-d-c-c',
    title: `Circle ${counter}`,
    lat: 38.8977,
    lng: -77.0365,
    alt: null,
    visible: true,
    group: 'Drawing Objects',
    callsign: '',
    team: '',
    speed: 0,
    bearing: 0,
    remarks: '',
    how: 'h-g-i-g-o',
    editable: true,
    movable: true,
    iconUri: null,
    radius: 1000,
    rings: 1,
    strokeColor: '#FFFF0000',
    fillColor: '#33000000',
    ...overrides,
  };
}

export function makeRouteItem(
  overrides?: Partial<MapItemData>,
): MapItemData {
  counter++;
  return {
    uid: `route-${counter}`,
    type: 'b-m-r',
    title: `Route ${counter}`,
    lat: 38.8977,
    lng: -77.0365,
    alt: null,
    visible: true,
    group: 'Route',
    callsign: '',
    team: '',
    speed: 0,
    bearing: 0,
    remarks: '',
    how: 'h-g-i-g-o',
    editable: true,
    movable: true,
    iconUri: null,
    points: [
      { lat: 38.88, lng: -77.03 },
      { lat: 38.89, lng: -77.02 },
    ],
    routeMethod: 'Driving',
    routeDirection: 'Infil',
    routeType: 'Primary',
    ...overrides,
  };
}

export function makeNavState(
  overrides?: Partial<NavigationState>,
): NavigationState {
  return {
    active: false,
    routeUid: null,
    currentWaypointIndex: -1,
    gpsLost: false,
    ...overrides,
  };
}

export function makeContact(overrides?: Partial<ContactData>): ContactData {
  counter++;
  return {
    uid: `contact-${counter}`,
    name: `User ${counter}`,
    status: 'current',
    team: 'Cyan',
    role: null,
    type: 'individual',
    connectorTypes: ['connector.ip'],
    unreadCount: 0,
    hasLocation: true,
    lat: 38.8977,
    lng: -77.0365,
    ...overrides,
  };
}

export function makeChatMessage(overrides?: Partial<ChatMessageData>): ChatMessageData {
  counter++;
  return {
    conversationId: `conv-${counter}`,
    conversationName: `Conversation ${counter}`,
    messageId: `msg-${counter}`,
    message: `Hello ${counter}`,
    senderUid: `sender-${counter}`,
    senderName: `Sender ${counter}`,
    timeSent: Date.now(),
    timeReceived: Date.now(),
    status: 'none',
    ...overrides,
  };
}

export function makeGeofenceAlert(overrides?: Partial<GeofenceAlertData>): GeofenceAlertData {
  counter++;
  return {
    itemUid: `item-${counter}`,
    itemCallsign: `UNIT-${counter}`,
    fenceUid: `fence-${counter}`,
    fenceTitle: `Fence ${counter}`,
    entered: true,
    timestamp: Date.now(),
    lat: 38.8977,
    lng: -77.0365,
    alt: 15,
    ...overrides,
  };
}

/**
 * Emit an event through the global bridge endpoint, simulating what Java does.
 */
export function emitFromNative(event: string, data: unknown) {
  window.__atakBridge?.emit(event, data);
}
