import { describe, it, expect, vi } from 'vitest';
import { createMockBridge } from './setup';
import { makeChatMessage } from './helpers';

async function loadModules() {
  return import('../index');
}

describe('Chat functions', () => {
  it('sendMessage calls bridge with conversationId and text', async () => {
    const sendFn = vi.fn();
    window._atak = createMockBridge({ sendChatMessage: sendFn });
    const { sendMessage } = await loadModules();

    sendMessage('conv-1', 'hello');
    expect(sendFn).toHaveBeenCalledWith('conv-1', 'hello');
  });

  it('openConversation calls bridge', async () => {
    const openFn = vi.fn();
    window._atak = createMockBridge({ openConversation: openFn });
    const { openConversation } = await loadModules();

    openConversation('uid-1');
    expect(openFn).toHaveBeenCalledWith('uid-1');
  });

  it('getChatHistory parses JSON from bridge', async () => {
    const msgs = [makeChatMessage(), makeChatMessage()];
    window._atak = createMockBridge({
      getChatHistory: () => JSON.stringify(msgs),
    });
    const { getChatHistory } = await loadModules();

    const result = getChatHistory('conv-1');
    expect(result).toHaveLength(2);
  });
});
