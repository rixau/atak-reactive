import type {
  ShapeOptions,
  CircleOptions,
  EllipseOptions,
  RectangleOptions,
  ShapeUpdateOptions,
  NativeBridge,
  MapItemData,
} from '../types';
import { mockBridge } from '../mock';

function getBridge(): NativeBridge {
  return window._atak ?? mockBridge;
}

const managedShapeUids = new Set<string>();

export function addShape(options: ShapeOptions): string | null {
  const raw = getBridge().addShape(JSON.stringify(options));
  if (raw === 'null') return null;
  managedShapeUids.add(raw);
  return raw;
}

export function addCircle(options: CircleOptions): string | null {
  const raw = getBridge().addCircle(JSON.stringify(options));
  if (raw === 'null') return null;
  managedShapeUids.add(raw);
  return raw;
}

export function addEllipse(options: EllipseOptions): string | null {
  const raw = getBridge().addEllipse(JSON.stringify(options));
  if (raw === 'null') return null;
  managedShapeUids.add(raw);
  return raw;
}

export function addRectangle(options: RectangleOptions): string | null {
  const raw = getBridge().addRectangle(JSON.stringify(options));
  if (raw === 'null') return null;
  managedShapeUids.add(raw);
  return raw;
}

export function updateShape(
  uid: string,
  options: ShapeUpdateOptions,
): boolean {
  return getBridge().updateShape(uid, JSON.stringify(options)) === 'true';
}

export function removeShape(uid: string): boolean {
  managedShapeUids.delete(uid);
  return getBridge().removeShape(uid) === 'true';
}

export function getManagedShapeUids(): ReadonlySet<string> {
  return managedShapeUids;
}

export function getPluginShapes(): MapItemData[] {
  const raw = getBridge().getPluginShapes();
  if (raw === '[]') return [];
  return JSON.parse(raw) as MapItemData[];
}
