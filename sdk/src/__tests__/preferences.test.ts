import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createMockBridge } from './setup';
import { emitFromNative } from './helpers';

describe('setPreference', () => {
  it('calls bridge with key and value', async () => {
    const spy = vi.fn(() => 'true');
    window._atak = createMockBridge({ setPreference: spy });
    const { setPreference } = await import('../bridge');
    const result = setPreference('unit', 'meters');
    expect(spy).toHaveBeenCalledWith('unit', 'meters');
    expect(result).toBe(true);
  });

  it('returns false when bridge returns false', async () => {
    window._atak = createMockBridge({ setPreference: () => 'false' });
    const { setPreference } = await import('../bridge');
    expect(setPreference('key', 'val')).toBe(false);
  });
});

describe('removePreference', () => {
  it('calls bridge with key', async () => {
    const spy = vi.fn(() => 'true');
    window._atak = createMockBridge({ removePreference: spy });
    const { removePreference } = await import('../bridge');
    const result = removePreference('unit');
    expect(spy).toHaveBeenCalledWith('unit');
    expect(result).toBe(true);
  });
});

describe('usePreference', () => {
  it('re-reads on bridgeResumed (changes made while the panel was detached)', async () => {
    let stored = 'meters';
    window._atak = createMockBridge({ getPreference: () => stored });
    const { usePreference } = await import('../hooks/usePreference');
    const { result } = renderHook(() => usePreference('unit'));
    expect(result.current[0]).toBe('meters');

    // Changed while covered: the preferenceChanged event was dropped.
    stored = 'feet';
    act(() => {
      emitFromNative('bridgeResumed', {});
    });
    expect(result.current[0]).toBe('feet');
  });

  it('re-reads the current key on bridgeResumed and stops after unmount', async () => {
    const getPreference = vi.fn((key: string) => `${key}-value`);
    window._atak = createMockBridge({ getPreference });
    const { usePreference } = await import('../hooks/usePreference');
    const { result, rerender, unmount } = renderHook(
      ({ k }: { k: string }) => usePreference(k),
      { initialProps: { k: 'a' } },
    );
    rerender({ k: 'b' });
    getPreference.mockClear();

    act(() => {
      emitFromNative('bridgeResumed', {});
    });
    expect(getPreference.mock.calls.map((c) => c[0])).toEqual(['b']);
    expect(result.current[0]).toBe('b-value');

    unmount();
    getPreference.mockClear();
    emitFromNative('bridgeResumed', {});
    expect(getPreference).not.toHaveBeenCalled();
  });

  it('reads initial value from getPreference', async () => {
    window._atak = createMockBridge({
      getPreference: (key: string) => key === 'unit' ? 'meters' : 'null',
    });
    const { usePreference } = await import('../hooks/usePreference');
    const { result } = renderHook(() => usePreference('unit'));
    expect(result.current[0]).toBe('meters');
  });

  it('returns null when preference does not exist', async () => {
    window._atak = createMockBridge({ getPreference: () => 'null' });
    const { usePreference } = await import('../hooks/usePreference');
    const { result } = renderHook(() => usePreference('missing'));
    expect(result.current[0]).toBeNull();
  });

  it('setter calls bridge and updates optimistically', async () => {
    const spy = vi.fn(() => 'true');
    window._atak = createMockBridge({
      getPreference: () => 'null',
      setPreference: spy,
    });
    const { usePreference } = await import('../hooks/usePreference');
    const { result } = renderHook(() => usePreference('unit'));

    act(() => {
      result.current[1]('feet');
    });

    expect(spy).toHaveBeenCalledWith('unit', 'feet');
    expect(result.current[0]).toBe('feet');
  });

  it('updates when preferenceChanged event fires for matching key', async () => {
    window._atak = createMockBridge({ getPreference: () => 'meters' });
    const { usePreference } = await import('../hooks/usePreference');
    const { result } = renderHook(() => usePreference('unit'));
    expect(result.current[0]).toBe('meters');

    act(() => {
      emitFromNative('preferenceChanged', { key: 'unit', value: 'feet' });
    });
    expect(result.current[0]).toBe('feet');
  });

  it('ignores preferenceChanged events for other keys', async () => {
    window._atak = createMockBridge({ getPreference: () => 'meters' });
    const { usePreference } = await import('../hooks/usePreference');
    const { result } = renderHook(() => usePreference('unit'));

    act(() => {
      emitFromNative('preferenceChanged', { key: 'other', value: 'changed' });
    });
    expect(result.current[0]).toBe('meters');
  });
});
