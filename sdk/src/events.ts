import type { AtakEventMap, AtakEventName } from './types';

type Listener<T> = (data: T) => void;

const listeners = new Map<string, Set<Listener<unknown>>>();

// Set up the global bridge endpoint for Java to call into
// Preserve existing instance across HMR
if (!window.__atakBridge) {
  window.__atakBridge = {
    emit(event: string, data: unknown) {
      const set = listeners.get(event);
      if (set) {
        set.forEach((fn) => {
          try {
            fn(data);
          } catch (e) {
            console.error(`[atak] Error in ${event} listener:`, e);
          }
        });
      }
    },
  };
}

export function on<E extends AtakEventName>(
  event: E,
  fn: Listener<AtakEventMap[E]>,
): void {
  let set = listeners.get(event);
  if (!set) {
    set = new Set();
    listeners.set(event, set);

    // Tell Java side to start sending this event
    window._atak?.subscribe(event);
  }
  set.add(fn as Listener<unknown>);
}

export function off<E extends AtakEventName>(
  event: E,
  fn: Listener<AtakEventMap[E]>,
): void {
  const set = listeners.get(event);
  if (!set) return;
  set.delete(fn as Listener<unknown>);

  if (set.size === 0) {
    listeners.delete(event);
    window._atak?.unsubscribe(event);
  }
}
