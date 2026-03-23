import { useEffect, useState, useCallback } from 'react';
import type { CotEventData } from '../types';
import { cotStore } from '../cot';

/**
 * Hook that subscribes to inbound CoT events and returns the latest state per UID.
 * Optional type filter with wildcard prefix support (e.g. 'a-f-*').
 */
export function useCotStream(filter?: { type?: string }): CotEventData[] {
  const [items, setItems] = useState<CotEventData[]>([]);

  useEffect(() => {
    return cotStore.subscribe(filter, setItems);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filter)]);

  return items;
}

/**
 * Hook that fires a callback for every inbound CoT event. No state, no dedup.
 */
export function useCotEvent(callback: (event: CotEventData) => void): void {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableCallback = useCallback(callback, []);

  useEffect(() => {
    return cotStore.subscribeRaw(stableCallback);
  }, [stableCallback]);
}
