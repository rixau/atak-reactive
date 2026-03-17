import { useEffect, useState, useCallback } from 'react';
import type { AtakEventMap, AtakEventName, SelfLocation } from './types';
import { getSelfLocation as bridgeGetSelfLocation } from './bridge';
import { on, off } from './events';

/**
 * Hook that returns the current self location.
 * Subscribes to selfLocationChanged events and also polls on mount.
 */
export function useSelfLocation(): SelfLocation | null {
  const [location, setLocation] = useState<SelfLocation | null>(null);

  useEffect(() => {
    // Initial fetch
    const loc = bridgeGetSelfLocation();
    setLocation(loc);

    // Subscribe to updates
    const handler = (data: SelfLocation) => setLocation(data);
    on('selfLocationChanged', handler);
    return () => off('selfLocationChanged', handler);
  }, []);

  return location;
}

/**
 * Hook that subscribes to an ATAK map event and returns the last received payload.
 */
export function useMapEvent<E extends AtakEventName>(
  event: E,
): AtakEventMap[E] | null {
  const [data, setData] = useState<AtakEventMap[E] | null>(null);

  useEffect(() => {
    const handler = (payload: AtakEventMap[E]) => setData(payload);
    on(event, handler);
    return () => off(event, handler);
  }, [event]);

  return data;
}

/**
 * Hook that subscribes to an ATAK map event and calls the provided callback.
 */
export function useAtakEvent<E extends AtakEventName>(
  event: E,
  callback: (data: AtakEventMap[E]) => void,
): void {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableCallback = useCallback(callback, []);

  useEffect(() => {
    on(event, stableCallback);
    return () => off(event, stableCallback);
  }, [event, stableCallback]);
}
