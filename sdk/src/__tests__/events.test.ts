import { describe, it, expect, vi } from 'vitest';
import { createMockBridge } from './setup';

function loadModules() {
  return import('../index');
}

describe('event system', () => {
  it('routes mapItemsChanged events to listeners', async () => {
    window._atak = createMockBridge();
    const { on, off } = await loadModules();

    const handler = vi.fn();
    on('mapItemsChanged', handler);

    const payload = {
      added: [],
      removed: [],
      updated: [],
    };

    window.__atakBridge!.emit('mapItemsChanged', payload);

    expect(handler).toHaveBeenCalledWith(payload);

    off('mapItemsChanged', handler);

    window.__atakBridge!.emit('mapItemsChanged', payload);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('subscribes to native on first listener and unsubscribes on last', async () => {
    const subscribeFn = vi.fn();
    const unsubscribeFn = vi.fn();

    window._atak = createMockBridge({
      subscribe: subscribeFn,
      unsubscribe: unsubscribeFn,
    });

    const { on, off } = await loadModules();

    const handler1 = vi.fn();
    const handler2 = vi.fn();

    on('mapClick', handler1);
    expect(subscribeFn).toHaveBeenCalledWith('mapClick');
    expect(subscribeFn).toHaveBeenCalledTimes(1);

    on('mapClick', handler2);
    expect(subscribeFn).toHaveBeenCalledTimes(1);

    off('mapClick', handler1);
    expect(unsubscribeFn).not.toHaveBeenCalled();

    off('mapClick', handler2);
    expect(unsubscribeFn).toHaveBeenCalledWith('mapClick');
  });
});
