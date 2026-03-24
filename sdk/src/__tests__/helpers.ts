import type { MapItemData, CotEventData } from '../types';

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

/**
 * Emit an event through the global bridge endpoint, simulating what Java does.
 */
export function emitFromNative(event: string, data: unknown) {
  window.__atakBridge?.emit(event, data);
}
