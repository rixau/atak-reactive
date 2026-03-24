import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createMockBridge } from '../setup';
import { makeChatMessage, emitFromNative } from '../helpers';

async function loadModules() {
  return import('../../index');
}

describe('useChat', () => {
  it('loads history on mount', async () => {
    const msgs = [
      makeChatMessage({ conversationId: 'conv-1', messageId: 'h1' }),
    ];
    window._atak = createMockBridge({
      getChatHistory: () => JSON.stringify(msgs),
    });
    const { useChat } = await loadModules();
    const { result } = renderHook(() => useChat('conv-1'));

    expect(result.current).toHaveLength(1);
    expect(result.current[0].messageId).toBe('h1');
  });

  it('appends new messages from events', async () => {
    window._atak = createMockBridge();
    const { useChat } = await loadModules();
    const { result } = renderHook(() => useChat('conv-1'));

    expect(result.current).toHaveLength(0);

    act(() => {
      emitFromNative('chatMessage', makeChatMessage({
        conversationId: 'conv-1',
        messageId: 'new-1',
      }));
    });

    expect(result.current).toHaveLength(1);
  });

  it('stops stream on unmount', async () => {
    const stopFn = vi.fn();
    window._atak = createMockBridge({ unsubscribeChat: stopFn });
    const { useChat } = await loadModules();
    const { unmount } = renderHook(() => useChat('conv-1'));

    unmount();
    expect(stopFn).toHaveBeenCalled();
  });
});
