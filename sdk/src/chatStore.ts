import type { ChatMessageData } from './types';
import { on, off } from './events';

type ChatCallback = (messages: ChatMessageData[]) => void;

class ChatStore {
  private conversations = new Map<string, ChatMessageData[]>();
  private subscribers = new Map<string, Set<ChatCallback>>();
  private streamActive = false;

  private getBridge() {
    return window._atak;
  }

  subscribe(
    conversationId: string,
    callback: ChatCallback,
  ): () => void {
    // Load history on first subscribe to this conversation
    if (!this.conversations.has(conversationId)) {
      const raw = this.getBridge()?.getChatHistory(conversationId, 100);
      const history = raw ? JSON.parse(raw) as ChatMessageData[] : [];
      this.conversations.set(conversationId, history);
    }

    let subs = this.subscribers.get(conversationId);
    if (!subs) {
      subs = new Set();
      this.subscribers.set(conversationId, subs);
    }
    subs.add(callback);

    this.ensureStream();

    callback(this.conversations.get(conversationId)!);

    return () => {
      subs!.delete(callback);
      if (subs!.size === 0) this.subscribers.delete(conversationId);
      this.maybeStopStream();
    };
  }

  private ensureStream() {
    if (this.streamActive) return;
    this.streamActive = true;
    on('chatMessage', this.handleEvent);
    this.getBridge()?.subscribeChat();
  }

  private maybeStopStream() {
    let totalSubs = 0;
    for (const subs of this.subscribers.values()) {
      totalSubs += subs.size;
    }
    if (totalSubs > 0) return;

    this.streamActive = false;
    off('chatMessage', this.handleEvent);
    this.getBridge()?.unsubscribeChat();
  }

  private handleEvent = (msg: ChatMessageData) => {
    const msgs = this.conversations.get(msg.conversationId) ?? [];
    // Dedupe by messageId
    if (!msgs.some(m => m.messageId === msg.messageId)) {
      msgs.push(msg);
      this.conversations.set(msg.conversationId, msgs);
    }
    const subs = this.subscribers.get(msg.conversationId);
    if (subs) {
      const snapshot = [...msgs];
      for (const cb of subs) cb(snapshot);
    }
  };

  reset() {
    if (this.streamActive) {
      off('chatMessage', this.handleEvent);
      this.getBridge()?.unsubscribeChat();
      this.streamActive = false;
    }
    this.conversations.clear();
    this.subscribers.clear();
  }
}

export const chatStore = new ChatStore();
