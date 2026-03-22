import { useEffect, useState, useRef, useMemo } from 'react';
import type { MapGroupData, MapItemData, MapItemFilter } from '../types';
import { getManagedUids } from '../bridge';
import { getMapGroups as bridgeGetMapGroups } from '../mapItems';
import { mapItemStore } from '../MapItemStore';

/**
 * Stabilizes a filter object reference so it only changes when the content changes.
 */
function useStableFilter(filter: MapItemFilter | undefined): MapItemFilter | undefined {
  const serialized = useMemo(() => JSON.stringify(filter), [filter]);
  const ref = useRef(filter);
  const prevSerialized = useRef(serialized);

  if (prevSerialized.current !== serialized) {
    prevSerialized.current = serialized;
    ref.current = filter;
  }

  return ref.current;
}

/**
 * Hook that queries and subscribes to map items matching an optional filter.
 * Returns a live array that updates as items are added, removed, or changed.
 */
export function useMapItems(filter?: MapItemFilter): MapItemData[] {
  const stableFilter = useStableFilter(filter);
  const [items, setItems] = useState<MapItemData[]>([]);

  useEffect(() => {
    return mapItemStore.subscribe(stableFilter, setItems);
  }, [stableFilter]);

  return items;
}

/**
 * Hook that returns a single map item by UID, with live updates.
 */
export function useMapItem(uid: string): MapItemData | null {
  const [item, setItem] = useState<MapItemData | null>(null);

  useEffect(() => {
    return mapItemStore.subscribe(undefined, (allItems) => {
      const found = allItems.find(i => i.uid === uid) ?? null;
      setItem(prev => {
        if (prev === found) return prev;
        if (prev === null || found === null) return found;
        if (prev.uid === found.uid && prev.lat === found.lat && prev.lng === found.lng
            && prev.title === found.title && prev.visible === found.visible
            && prev.type === found.type) return prev;
        return found;
      });
    });
  }, [uid]);

  return item;
}

/**
 * Hook that returns the map group tree, refreshing only when items are added or removed.
 */
export function useMapGroups(): MapGroupData[] {
  const [groups, setGroups] = useState<MapGroupData[]>([]);

  useEffect(() => {
    setGroups(bridgeGetMapGroups());

    return mapItemStore.subscribeStructural(() => {
      setGroups(bridgeGetMapGroups());
    });
  }, []);

  return groups;
}

/**
 * Hook that returns items created by this plugin via addMarker(), with live updates.
 */
export function usePluginMarkers(): MapItemData[] {
  const [items, setItems] = useState<MapItemData[]>([]);

  useEffect(() => {
    return mapItemStore.subscribe(undefined, (allItems) => {
      const managed = getManagedUids();
      setItems(allItems.filter(i => managed.has(i.uid)));
    });
  }, []);

  return items;
}
