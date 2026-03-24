import type { ChatMessageData, ConversationInfo, NativeBridge } from '../types';
import { mockBridge } from '../mock';

function getBridge(): NativeBridge {
  return window._atak ?? mockBridge;
}

export function sendMessage(conversationId: string, text: string): void {
  getBridge().sendChatMessage(conversationId, text);
}

export function openConversation(contactUid: string): void {
  getBridge().openConversation(contactUid);
}

export function getChatHistory(conversationId: string, limit?: number): ChatMessageData[] {
  return JSON.parse(getBridge().getChatHistory(conversationId, limit ?? 100));
}

export function getConversations(): ConversationInfo[] {
  return JSON.parse(getBridge().getConversations());
}
