import { useEffect, useState } from 'react';
import type { MapItemData, RadialMenuEvent } from '../types';
import { on, off } from '../events';

/**
 * The map item whose radial menu is currently open, or null when none is.
 *
 * Useful for following the user's focus — showing details for whatever they just
 * long-pressed, without asking them to select it in your panel as well.
 *
 * Observes only. Opening the menu is ATAK's business and this never suppresses it.
 */
export function useRadialMenu(): MapItemData | null {
  const [item, setItem] = useState<MapItemData | null>(null);

  useEffect(() => {
    const handler = (event: RadialMenuEvent) => {
      setItem(event.open ? event.item : null);
    };
    on('radialMenuChanged', handler);
    return () => off('radialMenuChanged', handler);
  }, []);

  return item;
}
