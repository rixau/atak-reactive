import type { MapItemData } from './mapItems';

/**
 * ATAK's radial menu opening or closing on a map item.
 *
 * There is deliberately no "menu button clicked" event. ATAK dispatches each
 * radial button as its own broadcast action, so a plugin observes the buttons it
 * defined with `registerAction()` / `useIntentCallback()`; there is no hook for
 * observing arbitrary buttons, and the SDK previously declared one that nothing
 * could ever fire.
 */
export interface RadialMenuEvent {
  open: boolean;
  /** The item the menu belongs to. Null if ATAK reported the event without one. */
  item: MapItemData | null;
}
