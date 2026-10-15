import type { ChatMessageData } from '../types';
import { on, off } from '../events';

type ChatCallback = (messages: ChatMessageData[]) => void;

const HISTORY_LIMIT = 100;

class ChatStore {
  private conversations = new Map<string, ChatMessageData[]>();
  private subscribers = new Map<string, Set<ChatCallback>>();
  private streamActive = false;

  private getBridge() {
    return window._atak;
  }

  private fetchHistory(conversationId: string): ChatMessageData[] {
    const raw = this.getBridge()?.getChatHistory(conversationId, HISTORY_LIMIT);
    return raw ? JSON.parse(raw) as ChatMessageData[] : [];
  }

  subscribe(
    conversationId: string,
    callback: ChatCallback,
  ): () => void {
    // Load history on first subscribe to this conversation
    if (!this.conversations.has(conversationId)) {
      this.conversations.set(conversationId, this.fetchHistory(conversationId));
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
    on('bridgeResumed', this.handleResumed);
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
    off('bridgeResumed', this.handleResumed);
    this.getBridge()?.unsubscribeChat();
  }

  /**
   * The panel was detached, so messages that arrived meantime were never
   * delivered. Re-read the history of every loaded conversation. A message
   * held here that the re-read does not include and that is newer than all of
   * it (one that came in live between the resume and this read) is kept.
   */
  private handleResumed = () => {
    for (const conversationId of [...this.conversations.keys()]) {
      const fresh = this.fetchHistory(conversationId);
      const known = new Set(fresh.map(m => m.messageId));
      const newest = fresh.reduce((t, m) => Math.max(t, m.timeReceived), 0);
      const held = this.conversations.get(conversationId) ?? [];
      const merged = [
        ...fresh,
        ...held.filter(m => !known.has(m.messageId) && m.timeReceived > newest),
      ];
      this.conversations.set(conversationId, merged);
      const subs = this.subscribers.get(conversationId);
      if (subs) {
        const snapshot = [...merged];
        for (const cb of subs) cb(snapshot);
      }
    }
  };

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
      off('bridgeResumed', this.handleResumed);
      this.getBridge()?.unsubscribeChat();
      this.streamActive = false;
    }
    this.conversations.clear();
    this.subscribers.clear();
  }
}

export const chatStore = new ChatStore();
