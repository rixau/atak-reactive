import { useEffect, useState } from 'react';
import type { ContactData } from '../types';
import { contactStore } from '../contactStore';

export function useContact(uid: string): ContactData | null {
  const [contact, setContact] = useState<ContactData | null>(null);

  useEffect(() => {
    return contactStore.subscribe(undefined, (all) => {
      const found = all.find(c => c.uid === uid) ?? null;
      setContact(prev => {
        if (prev === found) return prev;
        if (prev === null || found === null) return found;
        if (prev.uid === found.uid && prev.name === found.name
            && prev.status === found.status && prev.team === found.team
            && prev.role === found.role && prev.unreadCount === found.unreadCount) return prev;
        return found;
      });
    });
  }, [uid]);

  return contact;
}
