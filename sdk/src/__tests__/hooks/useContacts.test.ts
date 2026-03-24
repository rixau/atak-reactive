import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createMockBridge } from '../setup';
import { makeContact, emitFromNative } from '../helpers';

async function loadModules() {
  return import('../../index');
}

describe('useContacts', () => {
  it('returns empty array initially', async () => {
    window._atak = createMockBridge();
    const { useContacts } = await loadModules();
    const { result } = renderHook(() => useContacts());
    expect(result.current).toHaveLength(0);
  });

  it('updates when contacts change', async () => {
    window._atak = createMockBridge();
    const { useContacts } = await loadModules();
    const { result } = renderHook(() => useContacts());

    act(() => {
      emitFromNative('contactsChanged', [makeContact({ uid: 'u1' })]);
    });

    expect(result.current).toHaveLength(1);
    expect(result.current[0].uid).toBe('u1');
  });

  it('applies team filter', async () => {
    window._atak = createMockBridge();
    const { useContacts } = await loadModules();
    const { result } = renderHook(() => useContacts({ team: 'Cyan' }));

    act(() => {
      emitFromNative('contactsChanged', [
        makeContact({ uid: 'c1', team: 'Cyan' }),
        makeContact({ uid: 'r1', team: 'Red' }),
      ]);
    });

    expect(result.current).toHaveLength(1);
    expect(result.current[0].uid).toBe('c1');
  });

  it('stops stream on unmount', async () => {
    const stopFn = vi.fn();
    window._atak = createMockBridge({ unsubscribeContacts: stopFn });
    const { useContacts } = await loadModules();
    const { unmount } = renderHook(() => useContacts());

    unmount();
    expect(stopFn).toHaveBeenCalled();
  });
});
