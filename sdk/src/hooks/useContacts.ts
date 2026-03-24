import { useEffect, useState, useMemo, useRef } from 'react';
import type { ContactData, ContactFilter } from '../types';
import { contactStore } from '../stores/contactStore';

function useStableContactFilter(filter: ContactFilter | undefined): ContactFilter | undefined {
  const serialized = useMemo(() => JSON.stringify(filter), [filter]);
  const ref = useRef(filter);
  const prevSerialized = useRef(serialized);

  if (prevSerialized.current !== serialized) {
    prevSerialized.current = serialized;
    ref.current = filter;
  }

  return ref.current;
}

export function useContacts(filter?: ContactFilter): ContactData[] {
  const stableFilter = useStableContactFilter(filter);
  const [contacts, setContacts] = useState<ContactData[]>([]);

  useEffect(() => {
    return contactStore.subscribe(stableFilter, setContacts);
  }, [stableFilter]);

  return contacts;
}
