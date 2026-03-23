import type { CotEventData, CotDispatchTarget, NativeBridge } from './types';
import { mockBridge } from './mock';
import { on, off } from './events';

function getBridge(): NativeBridge {
  return window._atak ?? mockBridge;
}

export function startCotStream(): void {
  getBridge().startCotStream();
}

export function stopCotStream(): void {
  getBridge().stopCotStream();
}

export function sendCot(event: CotEventData, dispatch: CotDispatchTarget): boolean {
  const result = getBridge().sendCot(JSON.stringify(event), dispatch);
  return result === 'true';
}

export function sendCotToContacts(event: CotEventData, contactUids: string[]): boolean {
  const result = getBridge().sendCotToContacts(
    JSON.stringify(event),
    JSON.stringify(contactUids),
  );
  return result === 'true';
}

// --- CoT Store ---

type CotCallback = (items: CotEventData[]) => void;
type CotRawCallback = (event: CotEventData) => void;

interface CotSubscriber {
  filter: { type?: string } | undefined;
  callback: CotCallback;
}

let subIdCounter = 0;

class CotStore {
  private items = new Map<string, CotEventData>();
  private subscribers = new Map<string, CotSubscriber>();
  private rawCallbacks = new Set<CotRawCallback>();
  private streamActive = false;
  private refCount = 0;

  subscribe(
    filter: { type?: string } | undefined,
    callback: CotCallback,
  ): () => void {
    const id = `cot_sub_${++subIdCounter}`;
    this.subscribers.set(id, { filter, callback });
    this.ensureStream();

    callback(this.getFiltered(filter));

    return () => {
      this.subscribers.delete(id);
      this.maybeStopStream();
    };
  }

  subscribeRaw(callback: CotRawCallback): () => void {
    this.rawCallbacks.add(callback);
    this.ensureStream();

    return () => {
      this.rawCallbacks.delete(callback);
      this.maybeStopStream();
    };
  }

  private getFiltered(filter?: { type?: string }): CotEventData[] {
    const all = Array.from(this.items.values());
    if (!filter?.type) return all;
    const typeFilter = filter.type;
    if (typeFilter.endsWith('*')) {
      const prefix = typeFilter.slice(0, -1);
      return all.filter(item => item.type.startsWith(prefix));
    }
    return all.filter(item => item.type === typeFilter);
  }

  private ensureStream() {
    if (this.streamActive) return;
    this.streamActive = true;
    this.refCount++;

    getBridge().startCotStream();
    on('cotReceived', this.handleEvent);
  }

  private maybeStopStream() {
    if (this.subscribers.size > 0 || this.rawCallbacks.size > 0) return;

    this.streamActive = false;
    off('cotReceived', this.handleEvent);
    getBridge().stopCotStream();
  }

  private handleEvent = (batch: CotEventData[]) => {
    for (const event of batch) {
      this.items.set(event.uid, event);

      for (const cb of this.rawCallbacks) {
        cb(event);
      }
    }

    for (const sub of this.subscribers.values()) {
      sub.callback(this.getFiltered(sub.filter));
    }
  };

  reset() {
    if (this.streamActive) {
      off('cotReceived', this.handleEvent);
      getBridge().stopCotStream();
      this.streamActive = false;
    }
    this.items.clear();
    this.subscribers.clear();
    this.rawCallbacks.clear();
    this.refCount = 0;
  }
}

export const cotStore = new CotStore();
