// Spec 062: entries placed together with a mirror preset. A change to one goes to every
// open member; a group shows only while two or more of its members are open.

export interface GroupMember {
  broker: string;
  ticket: number;
}

export interface EntryGroup {
  id: string;
  color: string;
  members: GroupMember[];
}

interface EntryRef {
  broker?: string;
  ticket: number;
}

const memberKey = (broker: string, ticket: number): string => `${broker}:${ticket}`;

export function groupOf(groups: EntryGroup[], entry: EntryRef): EntryGroup | undefined {
  return groups.find(g => g.members.some(m => m.broker === entry.broker && m.ticket === entry.ticket));
}

export function openMembers<T extends EntryRef>(group: EntryGroup, open: T[]): T[] {
  const keys = new Set(group.members.map(m => memberKey(m.broker, m.ticket)));
  return open.filter(p => keys.has(memberKey(p.broker ?? '', p.ticket)));
}

// The entry's group while it has two or more open members and a colour; otherwise none.
export function activeGroupOf<T extends EntryRef>(groups: EntryGroup[], entry: EntryRef, open: T[]): { group: EntryGroup; members: T[] } | null {
  const group = groupOf(groups, entry);
  if (!group || !group.color) return null;
  const members = openMembers(group, open);
  return members.length >= 2 ? { group, members } : null;
}

// The entries an action on `entry` must reach: its open group members, the entry first.
export function expandToGroup<T extends EntryRef>(groups: EntryGroup[], entry: T, open: T[]): T[] {
  const active = activeGroupOf(groups, entry, open);
  if (!active) return [entry];
  const same = (p: T) => p.broker === entry.broker && p.ticket === entry.ticket;
  return [entry, ...active.members.filter(p => !same(p))];
}

export function expandAllToGroups<T extends EntryRef>(groups: EntryGroup[], entries: T[], open: T[]): T[] {
  const seen = new Set<string>();
  return entries.flatMap(e => expandToGroup(groups, e, open)).filter(p => {
    const key = memberKey(p.broker ?? '', p.ticket);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
