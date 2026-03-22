import type { MapItemData, MapGroupData, NativeBridge } from './types';
import { mockBridge } from './mock';

function getBridge(): NativeBridge {
  return window._atak ?? mockBridge;
}

export function getMapItemsSnapshot(): MapItemData[] {
  const raw = getBridge().getMapItemsSnapshot();
  if (raw === '[]' || raw === 'null') return [];
  return JSON.parse(raw) as MapItemData[];
}

export function getMapItem(uid: string): MapItemData | null {
  const raw = getBridge().getMapItem(uid);
  if (raw === 'null') return null;
  return JSON.parse(raw) as MapItemData;
}

export function getMapGroups(): MapGroupData[] {
  const raw = getBridge().getMapGroups();
  if (raw === '[]' || raw === 'null') return [];
  return JSON.parse(raw) as MapGroupData[];
}

export function getPluginMarkers(): MapItemData[] {
  const raw = getBridge().getPluginMarkers();
  if (raw === '[]' || raw === 'null') return [];
  return JSON.parse(raw) as MapItemData[];
}

export function startMapItemStream(): void {
  getBridge().startMapItemStream();
}

export function stopMapItemStream(): void {
  getBridge().stopMapItemStream();
}
