import { useEffect, useRef, useState } from 'react';
import { on, off } from '../events';
import { setBackHandlerEnabled } from '../bridge/dropdown';

interface Entry {
  order: number;
  run: () => void;
}

/** Enabled handlers. The one with the highest order runs. */
const handlers = new Set<Entry>();

/** Hands out each hook's order at its first render. */
let nextOrder = 0;

// A reloaded page never ran the previous page's unmount cleanup, so Java may
// still hold the flag from it, and every back press would go to a handler that
// no longer exists. Clear it before any effect of this page can set it. Calls
// from one page reach the bridge in order, so this cannot land after a handler
// mounted on first render.
setBackHandlerEnabled(false);

function dispatch() {
  let top: Entry | undefined;
  handlers.forEach((e) => {
    if (!top || e.order > top.order) top = e;
  });
  top?.run();
}

/**
 * Handle the Android back button yourself, e.g. to close a modal or step back
 * through a form. While any handler is mounted (and enabled), back presses come
 * here instead of going back in router history or closing the panel.
 *
 * When more than one is enabled, the one in the most recently rendered UI runs:
 * a child before its parent, and a modal opened later before the page under it,
 * however often the page's handler is toggled while the modal is open.
 *
 * Unmount it, or pass `enabled: false`, once there is nothing left to go back
 * from, so back falls through to router history and then closes the panel.
 */
export function useBackHandler(handler: () => void, enabled = true): void {
  const ref = useRef(handler);
  // Fixed at first render, never on enable. Effects run child-first, so the order
  // they register in would put a parent above a child mounted with it; renders
  // run parent-first, so a counter read here ranks the child higher.
  const [order] = useState(() => ++nextOrder);

  useEffect(() => {
    ref.current = handler;
  });

  useEffect(() => {
    if (!enabled) return;
    const entry: Entry = { order, run: () => ref.current() };
    handlers.add(entry);
    if (handlers.size === 1) {
      on('backPressed', dispatch);
      setBackHandlerEnabled(true);
    }

    return () => {
      handlers.delete(entry);
      if (handlers.size === 0) {
        off('backPressed', dispatch);
        setBackHandlerEnabled(false);
      }
    };
  }, [enabled, order]);
}
