import type { NativeBridge } from '../types';
import { mockBridge } from '../mock';

function getBridge(): NativeBridge {
  return window._atak ?? mockBridge;
}

export function registerAction(action: string): void {
  getBridge().registerAction(action);
}

export function unregisterAction(action: string): void {
  getBridge().unregisterAction(action);
}

export function sendBroadcast(action: string, extras?: Record<string, unknown>): void {
  getBridge().sendBroadcast(action, extras ? JSON.stringify(extras) : 'null');
}
