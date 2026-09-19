import { useSyncExternalStore } from 'react';

// Tiny shared store: ActionRequiredCenter fetches, the admin nav badge reads.
let items = [];
const listeners = new Set();

export const publishActionItems = (next) => { items = next; listeners.forEach((l) => l()); };
export const useActionItems = () => useSyncExternalStore(
  (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
  () => items
);
export const openActionRequired = () => window.dispatchEvent(new Event('hikids:open-action-required'));
