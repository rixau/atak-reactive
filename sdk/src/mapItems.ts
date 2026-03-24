import type { MapItemData, MapGroupData, MarkerIconOptions, NativeBridge } from './types';
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

export function setItemMeta(uid: string, key: string, value: string): boolean {
  return getBridge().setItemMeta(uid, key, value) === 'true';
}

export function setItemMetaDouble(uid: string, key: string, value: number): boolean {
  return getBridge().setItemMetaDouble(uid, key, value) === 'true';
}

export function setItemMetaBool(uid: string, key: string, value: boolean): boolean {
  return getBridge().setItemMetaBool(uid, key, value) === 'true';
}

export function getItemMeta(uid: string, key: string): string | null {
  const raw = getBridge().getItemMeta(uid, key);
  if (raw === 'null') return null;
  return raw;
}

export function setMarkerIcon(uid: string, options: MarkerIconOptions): boolean {
  return getBridge().setMarkerIcon(uid, JSON.stringify(options)) === 'true';
}
