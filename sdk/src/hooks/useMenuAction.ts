import { useEffect, useCallback } from 'react';
import type { MenuActionEvent } from '../types';
import { on, off } from '../events';

/**
 * Hook that fires a callback when a radial menu button is clicked.
 *
 * With actionId: only fires for that specific button.
 * Without actionId: fires for all menu button clicks.
 */
export function useMenuAction(
  actionIdOrCallback: string | ((event: MenuActionEvent) => void),
  maybeCallback?: (event: MenuActionEvent) => void,
): void {
  const hasFilter = typeof actionIdOrCallback === 'string';
  const actionId = hasFilter ? actionIdOrCallback : undefined;
  const callback = hasFilter ? maybeCallback! : actionIdOrCallback;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableCallback = useCallback(callback, []);

  useEffect(() => {
    const handler = (event: MenuActionEvent) => {
      if (actionId && event.actionId !== actionId) return;
      stableCallback(event);
    };
    on('menuAction', handler);
    return () => off('menuAction', handler);
  }, [actionId, stableCallback]);
}
