import type { NativeBridge } from './types';
import { mockBridge } from './mock';

function getBridge(): NativeBridge {
  return window._atak ?? mockBridge;
}

export function createMapGroup(name: string, parent?: string): boolean {
  return getBridge().createMapGroup(name, parent ?? '') === 'true';
}

export function removeMapGroup(name: string): boolean {
  return getBridge().removeMapGroup(name) === 'true';
}

export function setGroupVisible(name: string, visible: boolean): boolean {
  return getBridge().setGroupVisible(name, String(visible)) === 'true';
}
