import type {
  RouteOptions,
  RouteUpdateOptions,
  WaypointOptions,
  NavigationState,
  NativeBridge,
  MapItemData,
} from '../types';
import { mockBridge } from '../mock';
import { on, off } from '../events';

function getBridge(): NativeBridge {
  return window._atak ?? mockBridge;
}

const managedRouteUids = new Set<string>();

export function addRoute(options: RouteOptions): string | null {
  const raw = getBridge().addRoute(JSON.stringify(options));
  if (raw === 'null') return null;
  managedRouteUids.add(raw);
  return raw;
}

export function updateRoute(
  uid: string,
  options: RouteUpdateOptions,
): boolean {
  return getBridge().updateRoute(uid, JSON.stringify(options)) === 'true';
}

export function addWaypoint(
  routeUid: string,
  options: WaypointOptions,
): boolean {
  return (
    getBridge().addWaypoint(routeUid, JSON.stringify(options)) === 'true'
  );
}

export function removeWaypoint(
  routeUid: string,
  waypointUid: string,
): boolean {
  return getBridge().removeWaypoint(routeUid, waypointUid) === 'true';
}

export function removeRoute(uid: string): boolean {
  managedRouteUids.delete(uid);
  return getBridge().removeRoute(uid) === 'true';
}

export function startNavigation(
  routeUid: string,
  options?: { startIndex?: number },
): boolean {
  return (
    getBridge().startNavigation(routeUid, JSON.stringify(options ?? {})) ===
    'true'
  );
}

export function stopNavigation(): boolean {
  return getBridge().stopNavigation() === 'true';
}

export function getManagedRouteUids(): ReadonlySet<string> {
  return managedRouteUids;
}

export function getPluginRoutes(): MapItemData[] {
  const raw = getBridge().getPluginRoutes();
  if (raw === '[]') return [];
  return JSON.parse(raw) as MapItemData[];
}

export function getNavigationState(): NavigationState {
  const raw = getBridge().getNavigationState();
  return JSON.parse(raw) as NavigationState;
}

export function onNavigationStateChanged(
  cb: (state: NavigationState) => void,
): () => void {
  const listener = (state: NavigationState) => cb(state);
  on('navigationStateChanged', listener);
  return () => off('navigationStateChanged', listener);
}
