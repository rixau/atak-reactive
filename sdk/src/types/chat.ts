export interface ChatMessageData {
  conversationId: string;
  conversationName: string;
  messageId: string;
  message: string;
  senderUid: string;
  senderName: string;
  timeSent: number;
  timeReceived: number;
  status: 'none' | 'delivered' | 'read' | 'pending';
  lat?: number;
  lng?: number;
}

export interface ConversationInfo {
  conversationId: string;
  conversationName: string;
  unreadCount: number;
}
