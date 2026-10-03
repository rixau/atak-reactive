import { describe, it, expect, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { render, renderHook } from '@testing-library/react';
import { createMockBridge } from '../setup';
import { emitFromNative } from '../helpers';

function loadModules() {
  return import('../../index');
}

describe('useBackHandler', () => {
  it('enables the native flag while mounted and clears it on unmount', async () => {
    const spy = vi.fn();
    window._atak = createMockBridge({ setBackHandlerEnabled: spy });
    const { useBackHandler } = await loadModules();

    const { unmount } = renderHook(() => useBackHandler(() => {}));
    expect(spy).toHaveBeenLastCalledWith(true);

    unmount();
    expect(spy).toHaveBeenLastCalledWith(false);
  });

  it('calls the handler on backPressed', async () => {
    window._atak = createMockBridge();
    const { useBackHandler } = await loadModules();
    const handler = vi.fn();

    const { unmount } = renderHook(() => useBackHandler(handler));
    emitFromNative('backPressed', {});
    expect(handler).toHaveBeenCalledTimes(1);

    unmount();
    emitFromNative('backPressed', {});
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('runs only the most recently mounted handler', async () => {
    window._atak = createMockBridge();
    const { useBackHandler } = await loadModules();
    const first = vi.fn();
    const second = vi.fn();

    const a = renderHook(() => useBackHandler(first));
    const b = renderHook(() => useBackHandler(second));

    emitFromNative('backPressed', {});
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();

    // Unmounting the top one hands back presses to the one below it.
    b.unmount();
    emitFromNative('backPressed', {});
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    a.unmount();
  });

  it('keeps the flag set until the last handler unmounts', async () => {
    const spy = vi.fn();
    window._atak = createMockBridge({ setBackHandlerEnabled: spy });
    const { useBackHandler } = await loadModules();

    const a = renderHook(() => useBackHandler(() => {}));
    const b = renderHook(() => useBackHandler(() => {}));
    a.unmount();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenLastCalledWith(true);

    b.unmount();
    expect(spy).toHaveBeenLastCalledWith(false);
  });

  it('uses the latest handler without re-registering', async () => {
    const spy = vi.fn();
    window._atak = createMockBridge({ setBackHandlerEnabled: spy });
    const { useBackHandler } = await loadModules();
    const before = vi.fn();
    const after = vi.fn();

    const { rerender, unmount } = renderHook(({ fn }) => useBackHandler(fn), {
      initialProps: { fn: before },
    });
    rerender({ fn: after });

    emitFromNative('backPressed', {});
    expect(after).toHaveBeenCalledTimes(1);
    expect(before).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('does nothing while disabled', async () => {
    const spy = vi.fn();
    window._atak = createMockBridge({ setBackHandlerEnabled: spy });
    const { useBackHandler } = await loadModules();
    const handler = vi.fn();

    const { rerender, unmount } = renderHook(
      ({ enabled }) => useBackHandler(handler, enabled),
      { initialProps: { enabled: false } },
    );
    expect(spy).not.toHaveBeenCalled();

    rerender({ enabled: true });
    expect(spy).toHaveBeenLastCalledWith(true);
    emitFromNative('backPressed', {});
    expect(handler).toHaveBeenCalledTimes(1);

    rerender({ enabled: false });
    expect(spy).toHaveBeenLastCalledWith(false);
    emitFromNative('backPressed', {});
    expect(handler).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('runs a child before a parent mounted in the same commit', async () => {
    window._atak = createMockBridge();
    const { useBackHandler } = await loadModules();
    const parent = vi.fn();
    const child = vi.fn();

    // Effects run child-first, so registration order alone would rank the parent on top.
    function Child() {
      useBackHandler(child);
      return null;
    }
    function Parent({ children }: { children?: ReactNode }) {
      useBackHandler(parent);
      return children;
    }

    const { unmount } = render(createElement(Parent, null, createElement(Child)));
    emitFromNative('backPressed', {});
    expect(child).toHaveBeenCalledTimes(1);
    expect(parent).not.toHaveBeenCalled();

    unmount();
  });

  it('keeps an open child on top when the parent handler is toggled', async () => {
    window._atak = createMockBridge();
    const { useBackHandler } = await loadModules();
    const parent = vi.fn();
    const child = vi.fn();

    function Child() {
      useBackHandler(child);
      return null;
    }
    function Parent({ enabled, showChild }: { enabled: boolean; showChild: boolean }) {
      useBackHandler(parent, enabled);
      return showChild ? createElement(Child) : null;
    }

    const { rerender, unmount } = render(
      createElement(Parent, { enabled: true, showChild: false }),
    );
    rerender(createElement(Parent, { enabled: true, showChild: true }));
    rerender(createElement(Parent, { enabled: false, showChild: true }));
    rerender(createElement(Parent, { enabled: true, showChild: true }));

    emitFromNative('backPressed', {});
    expect(child).toHaveBeenCalledTimes(1);
    expect(parent).not.toHaveBeenCalled();

    // Closing the child hands back presses to the parent again.
    rerender(createElement(Parent, { enabled: true, showChild: false }));
    emitFromNative('backPressed', {});
    expect(parent).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('does not throw on a bridge without setBackHandlerEnabled', async () => {
    const bridge = createMockBridge();
    delete bridge.setBackHandlerEnabled;
    window._atak = bridge;
    const { useBackHandler } = await loadModules();
    const handler = vi.fn();

    const { unmount } = renderHook(() => useBackHandler(handler));
    emitFromNative('backPressed', {});
    expect(handler).toHaveBeenCalledTimes(1);
    expect(() => unmount()).not.toThrow();
  });
});

describe('useBackHandler module load', () => {
  it('clears a flag left set by the previous page before any handler mounts', async () => {
    // A reload skips the old page's unmount cleanup, so Java may still hold the
    // flag. Loading the SDK must clear it.
    vi.resetModules();
    const spy = vi.fn();
    window._atak = createMockBridge({ setBackHandlerEnabled: spy });
    await import('../../hooks/useBackHandler');
    expect(spy).toHaveBeenCalledWith(false);
  });
});
