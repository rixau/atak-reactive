import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createMockBridge } from './setup';
import { emitFromNative } from './helpers';

describe('setDropdownSize', () => {
  it('calls bridge with width and height strings', async () => {
    const spy = vi.fn();
    window._atak = createMockBridge({ setDropdownSize: spy });
    const { setDropdownSize } = await import('../dropdown');
    setDropdownSize('half', 'full');
    expect(spy).toHaveBeenCalledWith('half', 'full');
  });
});

describe('getDropdownSize', () => {
  it('parses JSON from bridge', async () => {
    window._atak = createMockBridge({
      getDropdownSize: () => '{"width":0.33,"height":1.0}',
    });
    const { getDropdownSize } = await import('../dropdown');
    expect(getDropdownSize()).toEqual({ width: 0.33, height: 1.0 });
  });
});

describe('getNavVisible', () => {
  it('returns true when bridge returns "true"', async () => {
    window._atak = createMockBridge({ getNavVisible: () => 'true' });
    const { getNavVisible } = await import('../dropdown');
    expect(getNavVisible()).toBe(true);
  });

  it('returns false when bridge returns "false"', async () => {
    window._atak = createMockBridge({ getNavVisible: () => 'false' });
    const { getNavVisible } = await import('../dropdown');
    expect(getNavVisible()).toBe(false);
  });
});

describe('setNavVisible', () => {
  it('calls bridge with boolean', async () => {
    const spy = vi.fn();
    window._atak = createMockBridge({ setNavVisible: spy });
    const { setNavVisible } = await import('../dropdown');
    setNavVisible(false);
    expect(spy).toHaveBeenCalledWith(false);
  });
});

describe('useDropdownVisible', () => {
  it('returns true initially', async () => {
    window._atak = createMockBridge();
    const { useDropdownVisible } = await import('../hooks/useDropdown');
    const { result } = renderHook(() => useDropdownVisible());
    expect(result.current).toBe(true);
  });

  it('updates when dropDownVisible event fires', async () => {
    window._atak = createMockBridge();
    const { useDropdownVisible } = await import('../hooks/useDropdown');
    const { result } = renderHook(() => useDropdownVisible());

    act(() => {
      emitFromNative('dropDownVisible', false);
    });
    expect(result.current).toBe(false);

    act(() => {
      emitFromNative('dropDownVisible', true);
    });
    expect(result.current).toBe(true);
  });
});

describe('useDropdownSize', () => {
  it('seeds from getDropdownSize on mount', async () => {
    window._atak = createMockBridge({
      getDropdownSize: () => '{"width":0.33,"height":0.5}',
    });
    const { useDropdownSize } = await import('../hooks/useDropdown');
    const { result } = renderHook(() => useDropdownSize());
    expect(result.current).toEqual({ width: 0.33, height: 0.5 });
  });

  it('updates on dropDownSizeChanged event', async () => {
    window._atak = createMockBridge();
    const { useDropdownSize } = await import('../hooks/useDropdown');
    const { result } = renderHook(() => useDropdownSize());

    act(() => {
      emitFromNative('dropDownSizeChanged', { width: 1.0, height: 1.0 });
    });
    expect(result.current).toEqual({ width: 1.0, height: 1.0 });
  });
});

describe('useNavVisible', () => {
  it('seeds from getNavVisible on mount', async () => {
    window._atak = createMockBridge({ getNavVisible: () => 'false' });
    const { useNavVisible } = await import('../hooks/useDropdown');
    const { result } = renderHook(() => useNavVisible());
    expect(result.current[0]).toBe(false);
  });

  it('setter calls bridge setNavVisible', async () => {
    const spy = vi.fn();
    window._atak = createMockBridge({ setNavVisible: spy });
    const { useNavVisible } = await import('../hooks/useDropdown');
    const { result } = renderHook(() => useNavVisible());

    act(() => {
      result.current[1](false);
    });
    expect(spy).toHaveBeenCalledWith(false);
  });

  it('updates on navVisible event', async () => {
    window._atak = createMockBridge({ getNavVisible: () => 'true' });
    const { useNavVisible } = await import('../hooks/useDropdown');
    const { result } = renderHook(() => useNavVisible());
    expect(result.current[0]).toBe(true);

    act(() => {
      emitFromNative('navVisible', false);
    });
    expect(result.current[0]).toBe(false);
  });
});
