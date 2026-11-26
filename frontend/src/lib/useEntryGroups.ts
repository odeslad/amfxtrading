import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { apiFetch, apiSend } from './api';
import { openMembers, type EntryGroup } from './entryGroups';

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

export interface GroupMark {
  id: string;
  color: string;
}

// The star of each open entry whose group still has a colour and two or more open members.
export function useGroupMarks(open: { broker?: string; ticket: number }[]): (broker: string | undefined, ticket: number) => GroupMark | undefined {
  const groups = useEntryGroups();
  const marks = useMemo(() => {
    const byKey = new Map<string, GroupMark>();
    for (const g of groups) {
      if (!g.color) continue;
      const members = openMembers(g, open);
      if (members.length < 2) continue;
      members.forEach(m => byKey.set(`${m.broker}:${m.ticket}`, { id: g.id, color: g.color }));
    }
    return byKey;
  }, [groups, open]);
  return useCallback((broker, ticket) => marks.get(`${broker}:${ticket}`), [marks]);
}

export async function takeOutOfGroup(broker: string, ticket: number): Promise<void> {
  await apiSend('/entry-groups/members', 'DELETE', { broker, ticket });
}
