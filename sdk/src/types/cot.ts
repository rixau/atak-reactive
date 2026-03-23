export interface CotEventData {
  uid: string;
  type: string;
  lat: number;
  lng: number;
  alt: number | null;
  how: string;
  time: number;
  stale: number;
  callsign: string;
  team: string;
  detail: Record<string, unknown>;
}

export type CotDispatchTarget = 'external' | 'internal' | 'both';
