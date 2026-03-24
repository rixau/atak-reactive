import { useEffect, useState } from 'react';
import type { ChatMessageData } from '../types';
import { chatStore } from '../chatStore';

export function useChat(conversationId: string): ChatMessageData[] {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);

  useEffect(() => {
    return chatStore.subscribe(conversationId, setMessages);
  }, [conversationId]);

  return messages;
}
