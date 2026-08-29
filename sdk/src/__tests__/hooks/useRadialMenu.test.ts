import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { makeMapItem, makeRadialMenuEvent, emitFromNative } from '../helpers';

function loadModules() {
  return import('../../index');
}

describe('useRadialMenu', () => {
  it('starts with no open menu', async () => {
    const { useRadialMenu } = await loadModules();
    const { result } = renderHook(() => useRadialMenu());

    expect(result.current).toBeNull();
  });

  it('reports the item whose menu opened', async () => {
    const { useRadialMenu } = await loadModules();
    const { result } = renderHook(() => useRadialMenu());
    const item = makeMapItem({ uid: 'target-1', title: 'Alpha' });

    act(() => {
      emitFromNative('radialMenuChanged', makeRadialMenuEvent({ open: true, item }));
    });

    expect(result.current?.uid).toBe('target-1');
    expect(result.current?.title).toBe('Alpha');
  });

  it('clears when the menu closes', async () => {
    const { useRadialMenu } = await loadModules();
    const { result } = renderHook(() => useRadialMenu());
    const item = makeMapItem({ uid: 'target-1' });

    act(() => {
      emitFromNative('radialMenuChanged', makeRadialMenuEvent({ open: true, item }));
    });
    expect(result.current).not.toBeNull();

    act(() => {
      emitFromNative('radialMenuChanged', makeRadialMenuEvent({ open: false, item }));
    });
    expect(result.current).toBeNull();
  });

  it('follows the user from one item to the next', async () => {
    const { useRadialMenu } = await loadModules();
    const { result } = renderHook(() => useRadialMenu());

    act(() => {
      emitFromNative('radialMenuChanged',
        makeRadialMenuEvent({ open: true, item: makeMapItem({ uid: 'a' }) }));
    });
    act(() => {
      emitFromNative('radialMenuChanged',
        makeRadialMenuEvent({ open: true, item: makeMapItem({ uid: 'b' }) }));
    });

    expect(result.current?.uid).toBe('b');
  });

  it('tolerates an open event with no item', async () => {
    const { useRadialMenu } = await loadModules();
    const { result } = renderHook(() => useRadialMenu());

    act(() => {
      emitFromNative('radialMenuChanged', makeRadialMenuEvent({ open: true, item: null }));
    });

    expect(result.current).toBeNull();
  });

  it('unsubscribes on unmount', async () => {
    const { useRadialMenu } = await loadModules();
    const { result, unmount } = renderHook(() => useRadialMenu());
    unmount();

    act(() => {
      emitFromNative('radialMenuChanged',
        makeRadialMenuEvent({ open: true, item: makeMapItem({ uid: 'late' }) }));
    });

    expect(result.current).toBeNull();
  });
});
