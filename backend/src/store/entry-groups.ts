import { db } from '../db/client';

// Spec 062: entries placed together with a mirror preset. A group gets its colour on its
// second member and is deleted when none of its members is open (the frontend hides the
// star of a group with fewer than two open members). A group never mixes positions and
// pending orders: when some orders of a group fill, their positions move to the sibling
// group `<id>_f`, always the same id, so later fills join it.

export const GROUP_PALETTE = ['#f5a623', '#3a7bd5', '#c77dff', '#2ec4b6', '#ff6fa8', '#e8e8e8'] as const;
export const EMPTY_LIST_GRACE_MS = 5000;

export interface GroupMember {
  broker: string;
  ticket: number;
}

export interface EntryGroup {
  id: string;
  color: string;
  members: GroupMember[];
}

export interface OpenEntry {
  ticket: number;
  type: number;   // MT4: 0 buy, 1 sell, 2–5 pending orders
}

export interface EntryGroupRepo {
  loadAll(): Promise<EntryGroup[]>;
  createGroup(id: string): Promise<void>;
  setColor(id: string, color: string): Promise<void>;
  upsertMember(groupId: string, member: GroupMember): Promise<void>;
  removeMembers(broker: string, tickets: number[]): Promise<void>;
  deleteGroups(ids: string[]): Promise<void>;
}

type ChangeListener = (groups: EntryGroup[]) => void;

const FILLED_SUFFIX = '_f';
export const filledGroupId = (id: string): string => (id.endsWith(FILLED_SUFFIX) ? id : `${id}${FILLED_SUFFIX}`);

const entryKey = (broker: string, ticket: number): string => `${broker}:${ticket}`;

export function pickColor(groups: Iterable<EntryGroup>): string {
  const usage = new Map<string, number>(GROUP_PALETTE.map(c => [c, 0]));
  for (const g of groups) {
    if (usage.has(g.color)) usage.set(g.color, (usage.get(g.color) ?? 0) + 1);
  }
  return GROUP_PALETTE.reduce((best, c) => ((usage.get(c) ?? 0) < (usage.get(best) ?? 0) ? c : best), GROUP_PALETTE[0]);
}

export function createEntryGroupStore(repo: EntryGroupRepo, now: () => number = Date.now) {
  const groups = new Map<string, EntryGroup>();
  const appliedEntries = new Map<string, string>();
  const emptySince = new Map<string, number>();
  const marketEntries = new Map<string, boolean>();
  const listeners: ChangeListener[] = [];
  let writes: Promise<void> = Promise.resolve();

  const persist = (write: () => Promise<void>) => {
    writes = writes.then(write).catch((err: unknown) => {
      console.error('[GROUPS] persist failed', err instanceof Error ? err.message : String(err));
    });
  };

  const snapshot = (): EntryGroup[] =>
    [...groups.values()].map(g => ({ ...g, members: g.members.map(m => ({ ...m })) }));

  const notify = () => {
    const current = snapshot();
    listeners.forEach(fn => fn(current));
  };

  const groupOf = (broker: string, ticket: number): EntryGroup | undefined =>
    [...groups.values()].find(g => g.members.some(m => m.broker === broker && m.ticket === ticket));

  const dropEmpty = (candidates: EntryGroup[]) => {
    const empty = candidates.filter(g => g.members.length === 0 && groups.get(g.id) === g).map(g => g.id);
    if (empty.length === 0) return;
    empty.forEach(id => groups.delete(id));
    persist(() => repo.deleteGroups(empty));
  };

  // Moves or adds one entry into a group; false when it was already there.
  const join = (groupId: string, broker: string, ticket: number): boolean => {
    const previous = groupOf(broker, ticket);
    if (previous?.id === groupId) return false;
    if (previous) {
      previous.members = previous.members.filter(m => m.broker !== broker || m.ticket !== ticket);
      dropEmpty([previous]);
    }

    let group = groups.get(groupId);
    if (!group) {
      group = { id: groupId, color: '', members: [] };
      groups.set(groupId, group);
      persist(() => repo.createGroup(groupId));
    }
    group.members.push({ broker, ticket });
    persist(() => repo.upsertMember(groupId, { broker, ticket }));

    if (group.color === '' && group.members.length >= 2) {
      const others = [...groups.values()].filter(g => g.id !== groupId);
      const color = pickColor(others);
      group.color = color;
      persist(() => repo.setColor(groupId, color));
    }
    return true;
  };

  const detach = (broker: string, tickets: Set<number>): EntryGroup[] => {
    const touched: EntryGroup[] = [];
    for (const g of groups.values()) {
      const kept = g.members.filter(m => m.broker !== broker || !tickets.has(m.ticket));
      if (kept.length !== g.members.length) {
        g.members = kept;
        touched.push(g);
      }
    }
    return touched;
  };

  // The positions of a group of orders go to `<id>_f`: when pending orders remain beside them,
  // or once that sibling exists (the last order to fill joins it too). A group that was placed
  // at market has neither, so it stays whole. An entry whose broker has not reported yet (just
  // after a restart) is left where it is.
  const splitFilled = (): boolean => {
    let changed = false;
    for (const g of [...groups.values()]) {
      if (g.id.endsWith(FILLED_SUFFIX)) continue;
      const kinds = g.members.map(m => marketEntries.get(entryKey(m.broker, m.ticket)));
      if (!kinds.includes(true)) continue;
      if (!kinds.includes(false) && !groups.has(filledGroupId(g.id))) continue;
      const filled = g.members.filter((_, i) => kinds[i] === true);
      filled.forEach(m => { if (join(filledGroupId(g.id), m.broker, m.ticket)) changed = true; });
    }
    return changed;
  };

  return {
    async load(): Promise<void> {
      groups.clear();
      for (const g of await repo.loadAll()) groups.set(g.id, g);
    },

    onChange(fn: ChangeListener): void {
      listeners.push(fn);
    },

    getGroups: snapshot,

    addMember(groupId: string, broker: string, ticket: number): void {
      if (join(groupId, broker, ticket)) notify();
    },

    removeMember(broker: string, ticket: number): boolean {
      const touched = detach(broker, new Set([ticket]));
      if (touched.length === 0) return false;
      persist(() => repo.removeMembers(broker, [ticket]));
      dropEmpty(touched);
      notify();
      return true;
    },

    // Called on every positions message; only acts when the broker's open entries change.
    // An empty list must last EMPTY_LIST_GRACE_MS: an EA reconnecting reports no positions for a moment.
    syncOpenEntries(broker: string, entries: OpenEntry[]): void {
      const key = entries.map(e => `${e.ticket}:${e.type}`).sort().join(',');
      if (appliedEntries.get(broker) === key) return;

      if (entries.length === 0) {
        const since = emptySince.get(broker);
        if (since === undefined) { emptySince.set(broker, now()); return; }
        if (now() - since < EMPTY_LIST_GRACE_MS) return;
      }
      emptySince.delete(broker);
      appliedEntries.set(broker, key);

      for (const k of [...marketEntries.keys()]) if (k.startsWith(`${broker}:`)) marketEntries.delete(k);
      entries.forEach(e => marketEntries.set(entryKey(broker, e.ticket), e.type <= 1));

      const open = new Set(entries.map(e => e.ticket));
      const closed = new Set<number>();
      for (const g of groups.values()) {
        g.members.forEach(m => { if (m.broker === broker && !open.has(m.ticket)) closed.add(m.ticket); });
      }

      let changed = false;
      if (closed.size > 0) {
        const touched = detach(broker, closed);
        persist(() => repo.removeMembers(broker, [...closed]));
        dropEmpty(touched);
        changed = true;
      }
      if (splitFilled()) changed = true;
      if (changed) notify();
    },

    flush(): Promise<void> {
      return writes;
    },
  };
}

export type EntryGroupStore = ReturnType<typeof createEntryGroupStore>;

const prismaRepo: EntryGroupRepo = {
  async loadAll() {
    const rows = await db.entryGroup.findMany({ include: { members: true } });
    return rows.map(r => ({ id: r.id, color: r.color, members: r.members.map(m => ({ broker: m.broker, ticket: m.ticket })) }));
  },
  async createGroup(id) {
    await db.entryGroup.upsert({ where: { id }, create: { id }, update: {} });
  },
  async setColor(id, color) {
    await db.entryGroup.update({ where: { id }, data: { color } });
  },
  async upsertMember(groupId, { broker, ticket }) {
    await db.entryGroupMember.upsert({
      where: { broker_ticket: { broker, ticket } },
      create: { groupId, broker, ticket },
      update: { groupId },
    });
  },
  async removeMembers(broker, tickets) {
    await db.entryGroupMember.deleteMany({ where: { broker, ticket: { in: tickets } } });
  },
  async deleteGroups(ids) {
    await db.entryGroup.deleteMany({ where: { id: { in: ids } } });
  },
};

export const entryGroups = createEntryGroupStore(prismaRepo);
