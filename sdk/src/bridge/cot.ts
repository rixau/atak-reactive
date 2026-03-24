import type { CotEventData, CotDispatchTarget, NativeBridge } from '../types';
import { mockBridge } from '../mock';

function getBridge(): NativeBridge {
  return window._atak ?? mockBridge;
}

export function startCotStream(): void {
  getBridge().startCotStream();
}

export function stopCotStream(): void {
  getBridge().stopCotStream();
}

export function sendCot(event: CotEventData, dispatch: CotDispatchTarget): boolean {
  const result = getBridge().sendCot(JSON.stringify(event), dispatch);
  return result === 'true';
}

export function sendCotToContacts(event: CotEventData, contactUids: string[]): boolean {
  const result = getBridge().sendCotToContacts(
    JSON.stringify(event),
    JSON.stringify(contactUids),
  );
  return result === 'true';
}
