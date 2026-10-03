import { useEffect, useRef } from 'react';
import { on, off } from '../events';
import { setBackHandlerEnabled } from '../bridge/dropdown';

type Handler = { current: () => void };

/**
 * Mounted handlers, oldest first. Only the last one runs, so a modal opened over
 * a form gets the back press before the form does.
 */
const handlers: Handler[] = [];

function dispatch() {
  handlers[handlers.length - 1]?.current();
}

/**
 * Handle the Android back button yourself, e.g. to close a modal or step back
 * through a form. While any handler is mounted (and enabled), back presses come
 * here instead of going back in router history or closing the panel. When more
 * than one is mounted, the most recently mounted one runs.
 *
 * Unmount it, or pass `enabled: false`, once there is nothing left to go back
 * from, so back falls through to router history and then closes the panel.
 */
export function useBackHandler(handler: () => void, enabled = true): void {
  const ref = useRef(handler);

  useEffect(() => {
    ref.current = handler;
  });

  useEffect(() => {
    if (!enabled) return;
    // Its own entry, so the same hook re-enabled lands on top again.
    const entry: Handler = { current: () => ref.current() };
    handlers.push(entry);
    if (handlers.length === 1) {
      on('backPressed', dispatch);
      setBackHandlerEnabled(true);
    }

    return () => {
      const i = handlers.lastIndexOf(entry);
      if (i >= 0) handlers.splice(i, 1);
      if (handlers.length === 0) {
        off('backPressed', dispatch);
        setBackHandlerEnabled(false);
      }
    };
  }, [enabled]);
}
