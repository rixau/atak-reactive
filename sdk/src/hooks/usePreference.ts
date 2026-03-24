import { useEffect, useState, useCallback } from 'react';
import { on, off } from '../events';
import {
  getPreference,
  setPreference as bridgeSetPreference,
} from '../bridge';

/**
 * Read/write a single ATAK preference by key.
 * Reactive: updates on changes from any source (this plugin, other plugins, ATAK settings).
 */
export function usePreference(
  key: string,
): [string | null, (value: string) => void] {
  const [value, setValue] = useState<string | null>(() => getPreference(key));

  useEffect(() => {
    // Re-read if key changes
    setValue(getPreference(key));

    const handler = (data: { key: string; value: string | null }) => {
      if (data.key === key) {
        setValue(data.value);
      }
    };
    on('preferenceChanged', handler);
    return () => off('preferenceChanged', handler);
  }, [key]);

  const setter = useCallback(
    (newValue: string) => {
      setValue(newValue); // optimistic
      bridgeSetPreference(key, newValue);
    },
    [key],
  );

  return [value, setter];
}
