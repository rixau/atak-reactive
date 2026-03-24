import type { SelfLocation } from './common';
import type { MapItemsChangedEvent } from './mapItems';
import type { IntentData } from './intents';
import type { CotEventData } from './cot';
import type { MenuActionEvent } from './menu';
import type { NavigationState } from './routes';
import type { ContactData } from './contacts';
import type { ChatMessageData } from './chat';
import type { GeofenceAlertData } from './geofence';

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
  dropDownVisible: boolean;
  dropDownClose: Record<string, never>;
  dropDownSizeChanged: { width: number; height: number };
  navVisible: boolean;
  preferenceChanged: { key: string; value: string | null };
  menuAction: MenuActionEvent;
  navigationStateChanged: NavigationState;
  contactsChanged: ContactData[];
  chatMessage: ChatMessageData;
  geofenceAlert: GeofenceAlertData;
};

export type AtakEventName = keyof AtakEventMap;
