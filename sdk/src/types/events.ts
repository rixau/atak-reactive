import type { SelfLocation } from './common';
import type { MapItemsChangedEvent } from './mapItems';
import type { IntentData } from './intents';
import type { CotEventData } from './cot';
import type { RadialMenuEvent } from './menu';
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
  backPressed: Record<string, never>;
  navVisible: boolean;
  preferenceChanged: { key: string; value: string | null };
  radialMenuChanged: RadialMenuEvent;
  navigationStateChanged: NavigationState;
  contactsChanged: ContactData[];
  chatMessage: ChatMessageData;
  geofenceAlert: GeofenceAlertData;
  /**
   * The panel's view is back on screen after being detached (panel closed, or a
   * retained panel covered by another drop-down). While detached, the bridge
   * pauses its producers and drops every event, so anything that changed in the
   * meantime was not delivered. The built-in stores re-sync on this; listen for
   * it to re-fetch state you keep yourself.
   */
  bridgeResumed: Record<string, never>;
};

export type AtakEventName = keyof AtakEventMap;
