import { describe, it, expect, vi } from 'vitest';
import { createMockBridge } from './setup';
import { makeContact, emitFromNative } from './helpers';

async function loadModules() {
  return import('../index');
}

describe('ContactStore', () => {
  it('emits initial empty snapshot on first subscribe', async () => {
    window._atak = createMockBridge();
    const { contactStore } = await loadModules();
    const callback = vi.fn();

    contactStore.subscribe(undefined, callback);

    expect(callback).toHaveBeenCalledWith([]);
  });

  it('ref-counts subscribe/unsubscribe of native stream', async () => {
    const subscribeFn = vi.fn();
    const unsubscribeFn = vi.fn();
    window._atak = createMockBridge({
      subscribeContacts: subscribeFn,
      unsubscribeContacts: unsubscribeFn,
    });
    const { contactStore } = await loadModules();

    const unsub1 = contactStore.subscribe(undefined, vi.fn());
    expect(subscribeFn).toHaveBeenCalledTimes(1);

    const unsub2 = contactStore.subscribe(undefined, vi.fn());
    expect(subscribeFn).toHaveBeenCalledTimes(1); // not called again

    unsub1();
    expect(unsubscribeFn).not.toHaveBeenCalled();

    unsub2();
    expect(unsubscribeFn).toHaveBeenCalledTimes(1);
  });

  it('replaces full contact list on contactsChanged event', async () => {
    window._atak = createMockBridge();
    const { contactStore } = await loadModules();
    const callback = vi.fn();

    contactStore.subscribe(undefined, callback);

    emitFromNative('contactsChanged', [
      makeContact({ uid: 'c1' }),
      makeContact({ uid: 'c2' }),
    ]);
    expect(callback).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ uid: 'c1' }),
        expect.objectContaining({ uid: 'c2' }),
      ]),
    );

    // Replace with different list
    emitFromNative('contactsChanged', [
      makeContact({ uid: 'c3' }),
    ]);
    const lastCall = callback.mock.calls[callback.mock.calls.length - 1][0];
    expect(lastCall).toHaveLength(1);
    expect(lastCall[0].uid).toBe('c3');
  });

  it('filters by team', async () => {
    window._atak = createMockBridge();
    const { contactStore } = await loadModules();
    const callback = vi.fn();

    contactStore.subscribe({ team: 'Cyan' }, callback);

    emitFromNative('contactsChanged', [
      makeContact({ uid: 'c1', team: 'Cyan' }),
      makeContact({ uid: 'r1', team: 'Red' }),
    ]);

    const lastCall = callback.mock.calls[callback.mock.calls.length - 1][0];
    expect(lastCall).toHaveLength(1);
    expect(lastCall[0].uid).toBe('c1');
  });

  it('filters by status', async () => {
    window._atak = createMockBridge();
    const { contactStore } = await loadModules();
    const callback = vi.fn();

    contactStore.subscribe({ status: 'current' }, callback);

    emitFromNative('contactsChanged', [
      makeContact({ uid: 'c1', status: 'current' }),
      makeContact({ uid: 'c2', status: 'stale' }),
      makeContact({ uid: 'c3', status: 'dead' }),
    ]);

    const lastCall = callback.mock.calls[callback.mock.calls.length - 1][0];
    expect(lastCall).toHaveLength(1);
    expect(lastCall[0].uid).toBe('c1');
  });

  it('filters by type', async () => {
    window._atak = createMockBridge();
    const { contactStore } = await loadModules();
    const callback = vi.fn();

    contactStore.subscribe({ type: 'individual' }, callback);

    emitFromNative('contactsChanged', [
      makeContact({ uid: 'i1', type: 'individual' }),
      makeContact({ uid: 'g1', type: 'group' }),
    ]);

    const lastCall = callback.mock.calls[callback.mock.calls.length - 1][0];
    expect(lastCall).toHaveLength(1);
    expect(lastCall[0].uid).toBe('i1');
  });

  it('filters by multiple statuses', async () => {
    window._atak = createMockBridge();
    const { contactStore } = await loadModules();
    const callback = vi.fn();

    contactStore.subscribe({ status: ['current', 'stale'] }, callback);

    emitFromNative('contactsChanged', [
      makeContact({ uid: 'c1', status: 'current' }),
      makeContact({ uid: 'c2', status: 'stale' }),
      makeContact({ uid: 'c3', status: 'dead' }),
    ]);

    const lastCall = callback.mock.calls[callback.mock.calls.length - 1][0];
    expect(lastCall).toHaveLength(2);
  });
});
