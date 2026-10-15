import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createMockBridge } from '../setup';
import { emitFromNative } from '../helpers';

describe('useSelfLocation', () => {
  it('re-reads on bridgeResumed and stops after unmount', async () => {
    let loc = { lat: 1, lng: 2, alt: 0, bearing: 0, speed: 0 };
    const getSelfLocation = vi.fn(() => JSON.stringify(loc));
    window._atak = createMockBridge({ getSelfLocation });
    const { useSelfLocation } = await import('../../hooks/useEvents');
    const { result, unmount } = renderHook(() => useSelfLocation());
    expect(result.current?.lat).toBe(1);

    // Moved while the panel was detached: selfLocationChanged was dropped.
    loc = { lat: 3, lng: 4, alt: 0, bearing: 0, speed: 0 };
    act(() => {
      emitFromNative('bridgeResumed', {});
    });
    expect(result.current?.lat).toBe(3);

    unmount();
    getSelfLocation.mockClear();
    emitFromNative('bridgeResumed', {});
    expect(getSelfLocation).not.toHaveBeenCalled();
  });
});
