import { useEffect, useState, useCallback } from 'react';
import { on, off } from '../events';
import { getDropdownSize, getNavVisible, setNavVisible } from '../bridge/dropdown';

/**
 * Returns whether the dropdown is currently visible.
 * Use to pause expensive work when the dropdown is backgrounded.
 */
export function useDropdownVisible(): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const handler = (v: boolean) => setVisible(v);
    on('dropDownVisible', handler);
    return () => off('dropDownVisible', handler);
  }, []);

  return visible;
}

/**
 * Returns current dropdown dimensions as screen fractions.
 * Seeds from bridge on mount, updates reactively via events.
 */
export function useDropdownSize(): { width: number; height: number } {
  const [size, setSize] = useState(() => getDropdownSize());

  useEffect(() => {
    const handler = (data: { width: number; height: number }) => setSize(data);
    on('dropDownSizeChanged', handler);
    return () => off('dropDownSizeChanged', handler);
  }, []);

  return size;
}

/**
 * Returns current nav button visibility + setter.
 * Reactive: updates on changes from any source.
 */
export function useNavVisible(): [boolean, (visible: boolean) => void] {
  const [visible, setVisible] = useState(() => getNavVisible());

  useEffect(() => {
    const handler = (v: boolean) => setVisible(v);
    // navVisible is dropped while the panel's view is detached, so re-read
    // when it comes back.
    const resync = () => setVisible(getNavVisible());
    on('navVisible', handler);
    on('bridgeResumed', resync);
    return () => {
      off('navVisible', handler);
      off('bridgeResumed', resync);
    };
  }, []);

  const setter = useCallback((v: boolean) => {
    setNavVisible(v);
  }, []);

  return [visible, setter];
}
