import { useEffect, useState } from 'react';
import type { GeofenceAlertData } from '../types';
import { on, off } from '../events';

export function useGeofenceAlerts(fenceUid?: string): GeofenceAlertData[] {
  const [alerts, setAlerts] = useState<GeofenceAlertData[]>([]);

  useEffect(() => {
    const handler = (alert: GeofenceAlertData) => {
      if (fenceUid && alert.fenceUid !== fenceUid) return;
      setAlerts(prev => [...prev, alert]);
    };
    on('geofenceAlert', handler);
    return () => off('geofenceAlert', handler);
  }, [fenceUid]);

  return alerts;
}
