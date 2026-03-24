export interface ContactData {
  uid: string;
  name: string;
  status: 'current' | 'stale' | 'dead' | 'na';
  team: string | null;
  role: string | null;
  type: 'individual' | 'group';
  connectorTypes: string[];
  unreadCount: number;
  hasLocation: boolean;
  lat?: number;
  lng?: number;
}

export interface ContactFilter {
  status?: ContactData['status'] | ContactData['status'][];
  team?: string;
  role?: string;
  type?: 'individual' | 'group';
}
