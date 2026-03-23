import { useEffect, useState, useCallback } from 'react';
import type { IntentData } from '../types';
import { registerAction, unregisterAction } from '../intents';
import { on, off } from '../events';

/**
 * Hook that registers an intent action and returns the last received intent.
 */
export function useIntent(action: string): IntentData | null {
  const [data, setData] = useState<IntentData | null>(null);

  useEffect(() => {
    registerAction(action);

    const handler = (event: IntentData) => {
      if (event.action === action) {
        setData(event);
      }
    };
    on('intentReceived', handler);

    return () => {
      off('intentReceived', handler);
      unregisterAction(action);
    };
  }, [action]);

  return data;
}

/**
 * Hook that registers an intent action and calls the callback on each received intent.
 */
export function useIntentCallback(
  action: string,
  callback: (data: IntentData) => void,
): void {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableCallback = useCallback(callback, []);

  useEffect(() => {
    registerAction(action);

    const handler = (event: IntentData) => {
      if (event.action === action) {
        stableCallback(event);
      }
    };
    on('intentReceived', handler);

    return () => {
      off('intentReceived', handler);
      unregisterAction(action);
    };
  }, [action, stableCallback]);
}
