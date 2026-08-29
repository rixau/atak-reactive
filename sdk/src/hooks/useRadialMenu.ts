import type { MapItemData } from '../types';
import { useMapEvent } from './useEvents';

/**
 * The map item whose radial menu is currently open, or null when none is.
 *
 * Useful for following the user's focus — showing details for whatever they just
 * long-pressed, without asking them to select it in your panel as well.
 *
 * Observes only. Opening the menu is ATAK's business and this never suppresses it.
 *
 * Known gap: ATAK's map-point radial menu (long-press on empty map) bypasses the
 * menu event listener entirely, firing neither a show nor a hide. If the user
 * replaces an item's menu with a point menu, this hook keeps reporting the item
 * until the next real show/hide event. There is no public ATAK API that closes
 * that gap; treat the value as "last item menu", not a guarantee one is open.
 */
export function useRadialMenu(): MapItemData | null {
  const event = useMapEvent('radialMenuChanged');
  return event?.open ? event.item : null;
}
