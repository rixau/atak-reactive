import type { MapItemData, MapItemFilter, MapItemsChangedEvent } from './types';
import { on, off } from './events';

type ItemCallback = (items: MapItemData[]) => void;
type StructuralCallback = () => void;

interface Subscriber {
  filter: MapItemFilter | undefined;
  callback: ItemCallback;
}

interface StructuralSubscriber {
  callback: StructuralCallback;
}

let idCounter = 0;
function genId(): string {
  return `store_sub_${++idCounter}`;
}

class MapItemStore {
  private items = new Map<string, MapItemData>();
  private subscribers = new Map<string, Subscriber>();
  private structuralSubscribers = new Map<string, StructuralSubscriber>();
  private streamActive = false;
  private seeded = false;

  private getBridge() {
    return window._atak;
  }

  subscribe(
    filter: MapItemFilter | undefined,
    callback: ItemCallback,
  ): () => void {
    const id = genId();
    this.subscribers.set(id, { filter, callback });
    this.ensureStream();

    // Deliver current snapshot immediately
    callback(this.getFiltered(filter));

    return () => {
      this.subscribers.delete(id);
      this.maybeStopStream();
    };
  }

  subscribeStructural(callback: StructuralCallback): () => void {
    const id = genId();
    this.structuralSubscribers.set(id, { callback });
    this.ensureStream();

    return () => {
      this.structuralSubscribers.delete(id);
      this.maybeStopStream();
    };
  }

  getFiltered(filter?: MapItemFilter): MapItemData[] {
    const all = Array.from(this.items.values());
    if (!filter) return all;
    return all.filter(item => matchesFilter(item, filter));
  }

  getByUid(uid: string): MapItemData | undefined {
    return this.items.get(uid);
  }

  private ensureStream() {
    if (this.streamActive) return;
    this.streamActive = true;

    // Seed from snapshot first
    if (!this.seeded) {
      this.seed();
    }

    // Start native event stream
    this.getBridge()?.startMapItemStream();

    // Listen for push events
    on('mapItemsChanged', this.handleEvent);
  }

  private maybeStopStream() {
    if (this.subscribers.size > 0 || this.structuralSubscribers.size > 0) return;

    this.streamActive = false;
    off('mapItemsChanged', this.handleEvent);
    this.getBridge()?.stopMapItemStream();
  }

  private seed() {
    this.seeded = true;
    const raw = this.getBridge()?.getMapItemsSnapshot();
    if (!raw || raw === '[]' || raw === 'null') return;
    const snapshot = JSON.parse(raw) as MapItemData[];
    for (const item of snapshot) {
      this.items.set(item.uid, item);
    }
  }

  private handleEvent = (event: MapItemsChangedEvent) => {
    let hasStructuralChange = false;

    // Apply removals
    for (const uid of event.removed) {
      if (this.items.delete(uid)) {
        hasStructuralChange = true;
      }
    }

    // Apply updates
    for (const item of event.updated) {
      this.items.set(item.uid, item);
    }

    // Apply additions
    for (const item of event.added) {
      this.items.set(item.uid, item);
      hasStructuralChange = true;
    }

    // Notify item subscribers
    for (const sub of this.subscribers.values()) {
      sub.callback(this.getFiltered(sub.filter));
    }

    // Notify structural subscribers only on add/remove
    if (hasStructuralChange) {
      for (const sub of this.structuralSubscribers.values()) {
        sub.callback();
      }
    }
  };

  reset() {
    if (this.streamActive) {
      off('mapItemsChanged', this.handleEvent);
      this.getBridge()?.stopMapItemStream();
      this.streamActive = false;
    }
    this.items.clear();
    this.subscribers.clear();
    this.structuralSubscribers.clear();
    this.seeded = false;
  }
}

export function matchesFilter(item: MapItemData, filter: MapItemFilter): boolean {
  if (filter.type !== undefined) {
    if (filter.type.endsWith('*')) {
      const prefix = filter.type.slice(0, -1);
      if (!item.type.startsWith(prefix)) return false;
    } else {
      if (item.type !== filter.type) return false;
    }
  }

  if (filter.group !== undefined && item.group !== filter.group) return false;
  if (filter.visible !== undefined && item.visible !== filter.visible) return false;

  if (filter.meta) {
    for (const [key, value] of Object.entries(filter.meta)) {
      const itemValue = (item as unknown as Record<string, unknown>)[key];
      if (String(itemValue ?? '') !== value) return false;
    }
  }

  return true;
}

export const mapItemStore = new MapItemStore();
