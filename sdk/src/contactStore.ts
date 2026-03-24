import type { ContactData, ContactFilter } from './types';
import { on, off } from './events';

type ContactCallback = (contacts: ContactData[]) => void;

let idCounter = 0;
function genId(): string {
  return `contact_sub_${++idCounter}`;
}

function matchesContactFilter(contact: ContactData, filter: ContactFilter): boolean {
  if (filter.status !== undefined) {
    if (Array.isArray(filter.status)) {
      if (!filter.status.includes(contact.status)) return false;
    } else {
      if (contact.status !== filter.status) return false;
    }
  }
  if (filter.team !== undefined && contact.team !== filter.team) return false;
  if (filter.role !== undefined && contact.role !== filter.role) return false;
  if (filter.type !== undefined && contact.type !== filter.type) return false;
  return true;
}

class ContactStore {
  private contacts = new Map<string, ContactData>();
  private subscribers = new Map<string, { filter: ContactFilter | undefined; callback: ContactCallback }>();
  private streamActive = false;

  private getBridge() {
    return window._atak;
  }

  subscribe(
    filter: ContactFilter | undefined,
    callback: ContactCallback,
  ): () => void {
    const id = genId();
    this.subscribers.set(id, { filter, callback });
    this.ensureStream();

    callback(this.getFiltered(filter));

    return () => {
      this.subscribers.delete(id);
      this.maybeStopStream();
    };
  }

  getFiltered(filter?: ContactFilter): ContactData[] {
    const all = Array.from(this.contacts.values());
    if (!filter) return all;
    return all.filter(c => matchesContactFilter(c, filter));
  }

  getByUid(uid: string): ContactData | undefined {
    return this.contacts.get(uid);
  }

  private ensureStream() {
    if (this.streamActive) return;
    this.streamActive = true;
    on('contactsChanged', this.handleEvent);
    this.getBridge()?.subscribeContacts();
  }

  private maybeStopStream() {
    if (this.subscribers.size > 0) return;
    this.streamActive = false;
    off('contactsChanged', this.handleEvent);
    this.getBridge()?.unsubscribeContacts();
  }

  private handleEvent = (data: ContactData[]) => {
    this.contacts.clear();
    for (const c of data) {
      this.contacts.set(c.uid, c);
    }
    for (const sub of this.subscribers.values()) {
      sub.callback(this.getFiltered(sub.filter));
    }
  };

  reset() {
    if (this.streamActive) {
      off('contactsChanged', this.handleEvent);
      this.getBridge()?.unsubscribeContacts();
      this.streamActive = false;
    }
    this.contacts.clear();
    this.subscribers.clear();
  }
}

export { matchesContactFilter };
export const contactStore = new ContactStore();
