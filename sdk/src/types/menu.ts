import type { MapItemData } from './mapItems';

/**
 * ATAK's radial menu opening or closing on a map item.
 *
 * There is deliberately no "menu button clicked" event — ATAK cannot report which
 * button was clicked through public API. For reacting to your own radial buttons,
 * see README → "Reacting to radial menu buttons" (useIntentCallback + menu XML).
 */
export interface RadialMenuEvent {
  open: boolean;
  /** The item the menu belongs to. Null if ATAK reported the event without one. */
  item: MapItemData | null;
}
