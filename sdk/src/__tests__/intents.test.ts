import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createMockBridge } from './setup';
import { emitFromNative } from './helpers';

function loadModules() {
  return import('../index');
}

describe('intent broadcast', () => {
  it('useIntent registers action on mount and unregisters on unmount', async () => {
    const registerFn = vi.fn();
    const unregisterFn = vi.fn();
    window._atak = createMockBridge({
      registerAction: registerFn,
      unregisterAction: unregisterFn,
    });

    const { useIntent } = await loadModules();
    const { unmount } = renderHook(() => useIntent('com.example.ACTION'));

    expect(registerFn).toHaveBeenCalledWith('com.example.ACTION');

    unmount();
    expect(unregisterFn).toHaveBeenCalledWith('com.example.ACTION');
  });

  it('useIntent returns last received intent matching action', async () => {
    window._atak = createMockBridge();

    const { useIntent } = await loadModules();
    const { result } = renderHook(() => useIntent('com.example.ACTION'));

    expect(result.current).toBeNull();

    act(() => {
      emitFromNative('intentReceived', {
        action: 'com.example.ACTION',
        extras: { uid: 'marker-1' },
      });
    });

    expect(result.current).not.toBeNull();
    expect(result.current!.action).toBe('com.example.ACTION');
    expect(result.current!.extras.uid).toBe('marker-1');
  });

  it('useIntent ignores intents for other actions', async () => {
    window._atak = createMockBridge();

    const { useIntent } = await loadModules();
    const { result } = renderHook(() => useIntent('com.example.MY_ACTION'));

    act(() => {
      emitFromNative('intentReceived', {
        action: 'com.example.OTHER_ACTION',
        extras: {},
      });
    });

    expect(result.current).toBeNull();
  });

  it('useIntentCallback fires callback for matching action', async () => {
    window._atak = createMockBridge();

    const { useIntentCallback } = await loadModules();
    const callback = vi.fn();
    renderHook(() => useIntentCallback('com.example.ACTION', callback));

    act(() => {
      emitFromNative('intentReceived', {
        action: 'com.example.ACTION',
        extras: { key: 'value' },
      });
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0]![0].extras.key).toBe('value');
  });

  it('sendBroadcast calls bridge with action and extras', async () => {
    const sendFn = vi.fn();
    window._atak = createMockBridge({ sendBroadcast: sendFn });

    const { sendBroadcast } = await loadModules();
    sendBroadcast('com.example.ACTION', { uid: 'test' });

    expect(sendFn).toHaveBeenCalledWith(
      'com.example.ACTION',
      JSON.stringify({ uid: 'test' }),
    );
  });

  it('sendBroadcast works without extras', async () => {
    const sendFn = vi.fn();
    window._atak = createMockBridge({ sendBroadcast: sendFn });

    const { sendBroadcast } = await loadModules();
    sendBroadcast('com.example.ACTION');

    expect(sendFn).toHaveBeenCalledWith('com.example.ACTION', 'null');
  });
});
