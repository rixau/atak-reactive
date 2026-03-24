export interface MapItemData {
  uid: string;
  type: string;
  title: string;
  lat: number | null;
  lng: number | null;
  alt: number | null;
  visible: boolean;
  group: string | null;
  callsign: string;
  team: string;
  speed: number;
  bearing: number;
  remarks: string;
  how: string;
  editable: boolean;
  movable: boolean;
  iconUri: string | null;
}

export interface MapItemFilter {
  type?: string;
  group?: string;
  visible?: boolean;
  meta?: Record<string, string>;
}

export interface MapGroupData {
  name: string;
  childGroups: MapGroupData[];
  itemCount: number;
}

export interface MapItemsChangedEvent {
  added: MapItemData[];
  removed: string[];
  updated: MapItemData[];
}
