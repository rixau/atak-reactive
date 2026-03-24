import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createMockBridge } from '../setup';
import { makeContact, emitFromNative } from '../helpers';

async function loadModules() {
  return import('../../index');
}

describe('useContact', () => {
  it('returns null for unknown uid', async () => {
    window._atak = createMockBridge();
    const { useContact } = await loadModules();
    const { result } = renderHook(() => useContact('unknown'));
    expect(result.current).toBeNull();
  });

  it('returns matching contact', async () => {
    window._atak = createMockBridge();
    const { useContact } = await loadModules();
    const { result } = renderHook(() => useContact('u1'));

    act(() => {
      emitFromNative('contactsChanged', [
        makeContact({ uid: 'u1', name: 'Alpha' }),
        makeContact({ uid: 'u2', name: 'Bravo' }),
      ]);
    });

    expect(result.current).not.toBeNull();
    expect(result.current!.uid).toBe('u1');
    expect(result.current!.name).toBe('Alpha');
  });

  it('stable reference when contact unchanged', async () => {
    window._atak = createMockBridge();
    const { useContact } = await loadModules();
    const { result } = renderHook(() => useContact('u1'));

    act(() => {
      emitFromNative('contactsChanged', [
        makeContact({ uid: 'u1', name: 'Alpha', status: 'current', team: 'Cyan', role: null, unreadCount: 0 }),
      ]);
    });

    const ref1 = result.current;

    act(() => {
      emitFromNative('contactsChanged', [
        makeContact({ uid: 'u1', name: 'Alpha', status: 'current', team: 'Cyan', role: null, unreadCount: 0 }),
      ]);
    });

    expect(result.current).toBe(ref1);
  });

  it('becomes null when contact disappears', async () => {
    window._atak = createMockBridge();
    const { useContact } = await loadModules();
    const { result } = renderHook(() => useContact('u1'));

    act(() => {
      emitFromNative('contactsChanged', [makeContact({ uid: 'u1' })]);
    });
    expect(result.current).not.toBeNull();

    act(() => {
      emitFromNative('contactsChanged', []);
    });
    expect(result.current).toBeNull();
  });
});
