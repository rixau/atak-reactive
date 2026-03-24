export interface GeofenceAlertData {
  itemUid: string;
  itemCallsign: string;
  fenceUid: string;
  fenceTitle: string;
  entered: boolean;
  timestamp: number;
  lat: number;
  lng: number;
  alt: number;
}

export interface GeofenceOptions {
  shapeUid: string;
  trigger: 'entry' | 'exit' | 'both';
  monitoredTypes: 'all' | 'friendly' | 'hostile' | 'tak_users';
  rangeKm?: number;
  minElevation?: number;
  maxElevation?: number;
}
