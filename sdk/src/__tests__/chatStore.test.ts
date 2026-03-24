import { describe, it, expect, vi } from 'vitest';
import { createMockBridge } from './setup';
import { makeChatMessage, emitFromNative } from './helpers';

async function loadModules() {
  return import('../index');
}

describe('ChatStore', () => {
  it('loads history on first subscribe to a conversation', async () => {
    const msgs = [
      makeChatMessage({ conversationId: 'conv-1', messageId: 'h1' }),
      makeChatMessage({ conversationId: 'conv-1', messageId: 'h2' }),
    ];
    window._atak = createMockBridge({
      getChatHistory: () => JSON.stringify(msgs),
    });
    const { chatStore } = await loadModules();
    const callback = vi.fn();

    chatStore.subscribe('conv-1', callback);

    expect(callback).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ messageId: 'h1' }),
        expect.objectContaining({ messageId: 'h2' }),
      ]),
    );
  });

  it('ref-counts subscribe/unsubscribe of native stream', async () => {
    const subscribeFn = vi.fn();
    const unsubscribeFn = vi.fn();
    window._atak = createMockBridge({
      subscribeChat: subscribeFn,
      unsubscribeChat: unsubscribeFn,
    });
    const { chatStore } = await loadModules();

    const unsub1 = chatStore.subscribe('conv-1', vi.fn());
    expect(subscribeFn).toHaveBeenCalledTimes(1);

    const unsub2 = chatStore.subscribe('conv-2', vi.fn());
    expect(subscribeFn).toHaveBeenCalledTimes(1);

    unsub1();
    expect(unsubscribeFn).not.toHaveBeenCalled();

    unsub2();
    expect(unsubscribeFn).toHaveBeenCalledTimes(1);
  });

  it('appends new message from chatMessage event', async () => {
    window._atak = createMockBridge();
    const { chatStore } = await loadModules();
    const callback = vi.fn();

    chatStore.subscribe('conv-1', callback);
    expect(callback).toHaveBeenLastCalledWith([]);

    emitFromNative('chatMessage', makeChatMessage({
      conversationId: 'conv-1',
      messageId: 'new-1',
      message: 'Hello!',
    }));

    const lastCall = callback.mock.calls[callback.mock.calls.length - 1][0];
    expect(lastCall).toHaveLength(1);
    expect(lastCall[0].messageId).toBe('new-1');
  });

  it('deduplicates by messageId', async () => {
    window._atak = createMockBridge();
    const { chatStore } = await loadModules();
    const callback = vi.fn();

    chatStore.subscribe('conv-1', callback);

    const msg = makeChatMessage({ conversationId: 'conv-1', messageId: 'dup-1' });
    emitFromNative('chatMessage', msg);
    emitFromNative('chatMessage', msg);

    const lastCall = callback.mock.calls[callback.mock.calls.length - 1][0];
    expect(lastCall).toHaveLength(1);
  });

  it('routes messages to correct conversation subscribers', async () => {
    window._atak = createMockBridge();
    const { chatStore } = await loadModules();
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    chatStore.subscribe('conv-1', cb1);
    chatStore.subscribe('conv-2', cb2);

    const initialCb1Calls = cb1.mock.calls.length;
    const initialCb2Calls = cb2.mock.calls.length;

    emitFromNative('chatMessage', makeChatMessage({
      conversationId: 'conv-1',
      messageId: 'msg-for-1',
    }));

    expect(cb1.mock.calls.length).toBe(initialCb1Calls + 1);
    expect(cb2.mock.calls.length).toBe(initialCb2Calls); // not notified
  });

  it('does not notify unsubscribed callbacks', async () => {
    window._atak = createMockBridge();
    const { chatStore } = await loadModules();
    const callback = vi.fn();

    const unsub = chatStore.subscribe('conv-1', callback);
    const callsAfterSub = callback.mock.calls.length;

    unsub();

    emitFromNative('chatMessage', makeChatMessage({
      conversationId: 'conv-1',
      messageId: 'after-unsub',
    }));

    expect(callback.mock.calls.length).toBe(callsAfterSub);
  });
});
