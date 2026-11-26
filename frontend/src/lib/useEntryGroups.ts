import { useSyncExternalStore } from 'react';
import { apiFetch, apiSend } from './api';
import type { EntryGroup } from './entryGroups';

// Spec 062: one copy of the groups for the whole app, loaded by AppLayout and kept
// current by the WebSocket `entry_groups` message.

let snapshot: EntryGroup[] = [];
const listeners = new Set<() => void>();

export function setEntryGroups(groups: EntryGroup[]): void {
  snapshot = groups;
  for (const l of listeners) l();
}

const subscribeStore = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

const getSnapshot = (): EntryGroup[] => snapshot;

export function loadEntryGroups(signal?: AbortSignal): Promise<void> {
  return apiFetch<EntryGroup[]>('/entry-groups', { signal }).then(setEntryGroups).catch(() => {});
}

export function useEntryGroups(): EntryGroup[] {
  return useSyncExternalStore(subscribeStore, getSnapshot, getSnapshot);
}

export async function takeOutOfGroup(broker: string, ticket: number): Promise<void> {
  await apiSend('/entry-groups/members', 'DELETE', { broker, ticket });
}
