import type { SelfLocation } from './common';
import type { MapItemsChangedEvent } from './mapItems';
import type { IntentData } from './intents';
import type { CotEventData } from './cot';

export interface MapClickEvent {
  lat: number;
  lng: number;
}

export interface ItemSelectedEvent {
  uid: string;
  type: string;
  title: string;
  lat?: number;
  lng?: number;
}

export type AtakEventMap = {
  selfLocationChanged: SelfLocation;
  mapClick: MapClickEvent;
  mapLongPress: MapClickEvent;
  itemSelected: ItemSelectedEvent;
  mapItemsChanged: MapItemsChangedEvent;
  intentReceived: IntentData;
  cotReceived: CotEventData[];
};

export type AtakEventName = keyof AtakEventMap;
