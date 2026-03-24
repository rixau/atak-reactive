import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createMockBridge } from '../setup';
import { makeMenuAction, emitFromNative } from '../helpers';

function loadModules() {
  return import('../../index');
}

describe('useMenuAction', () => {
  it('fires callback for matching actionId', async () => {
    window._atak = createMockBridge();
    const { useMenuAction } = await loadModules();
    const callback = vi.fn();
    renderHook(() => useMenuAction('flag', callback));

    act(() => {
      emitFromNative('menuAction', makeMenuAction({ actionId: 'flag', itemUid: 'item-1' }));
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0]![0].itemUid).toBe('item-1');
  });

  it('ignores non-matching actionId', async () => {
    window._atak = createMockBridge();
    const { useMenuAction } = await loadModules();
    const callback = vi.fn();
    renderHook(() => useMenuAction('flag', callback));

    act(() => {
      emitFromNative('menuAction', makeMenuAction({ actionId: 'details' }));
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('fires for all actions when no actionId filter', async () => {
    window._atak = createMockBridge();
    const { useMenuAction } = await loadModules();
    const callback = vi.fn();
    renderHook(() => useMenuAction(callback));

    act(() => {
      emitFromNative('menuAction', makeMenuAction({ actionId: 'flag' }));
      emitFromNative('menuAction', makeMenuAction({ actionId: 'details' }));
    });

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('unsubscribes on unmount', async () => {
    window._atak = createMockBridge();
    const { useMenuAction } = await loadModules();
    const callback = vi.fn();
    const { unmount } = renderHook(() => useMenuAction('flag', callback));

    unmount();

    act(() => {
      emitFromNative('menuAction', makeMenuAction({ actionId: 'flag' }));
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('multiple hooks with different actionIds receive correct events', async () => {
    window._atak = createMockBridge();
    const { useMenuAction } = await loadModules();
    const flagCb = vi.fn();
    const detailsCb = vi.fn();
    renderHook(() => useMenuAction('flag', flagCb));
    renderHook(() => useMenuAction('details', detailsCb));

    act(() => {
      emitFromNative('menuAction', makeMenuAction({ actionId: 'flag' }));
    });

    expect(flagCb).toHaveBeenCalledTimes(1);
    expect(detailsCb).not.toHaveBeenCalled();

    act(() => {
      emitFromNative('menuAction', makeMenuAction({ actionId: 'details' }));
    });

    expect(flagCb).toHaveBeenCalledTimes(1);
    expect(detailsCb).toHaveBeenCalledTimes(1);
  });

  it('provides full event data in callback', async () => {
    window._atak = createMockBridge();
    const { useMenuAction } = await loadModules();
    const callback = vi.fn();
    renderHook(() => useMenuAction('flag', callback));

    const event = makeMenuAction({
      actionId: 'flag',
      itemUid: 'marker-42',
      itemType: 'a-h-G',
      title: 'Hostile Target',
    });

    act(() => {
      emitFromNative('menuAction', event);
    });

    expect(callback).toHaveBeenCalledTimes(1);
    const received = callback.mock.calls[0]![0];
    expect(received.actionId).toBe('flag');
    expect(received.itemUid).toBe('marker-42');
    expect(received.itemType).toBe('a-h-G');
    expect(received.title).toBe('Hostile Target');
  });
});
