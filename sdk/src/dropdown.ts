import type { NativeBridge } from './types';
import { mockBridge } from './mock';

function getBridge(): NativeBridge {
  return window._atak ?? mockBridge;
}

export type DropdownDimension = 'third' | 'half' | 'full';

export function setDropdownSize(
  width: DropdownDimension,
  height: DropdownDimension,
): void {
  getBridge().setDropdownSize(width, height);
}

export function getDropdownSize(): { width: number; height: number } {
  const raw = getBridge().getDropdownSize();
  return JSON.parse(raw) as { width: number; height: number };
}

export function setNavVisible(visible: boolean): void {
  getBridge().setNavVisible(visible);
}

export function getNavVisible(): boolean {
  return getBridge().getNavVisible() === 'true';
}
