import type { MapItemData } from './mapItems';

/**
 * ATAK's radial menu opening or closing on a map item.
 *
 * There is deliberately no "menu button clicked" event. A click on any radial
 * button is observable — the buttons are enumerable widgets whose click handlers
 * can be wrapped — but the action a button maps to lives in a private field of the
 * package-private BroadcastIntentMapAction, so which button was clicked cannot be
 * identified through public API.
 *
 * It is not needed. Radial buttons dispatch through AtakBroadcast under an action
 * string the plugin itself chose, so `registerAction()` / `useIntentCallback()`
 * already covers it, with the item available via a `{uid}` extra in the menu XML.
 * The SDK previously declared a `menuAction` event that nothing could ever fire.
 */
export interface RadialMenuEvent {
  open: boolean;
  /** The item the menu belongs to. Null if ATAK reported the event without one. */
  item: MapItemData | null;
}
