import { db } from '../db/client';

// Spec 062: entries placed together with a mirror preset. A group gets its colour on its
// second member; from then on it is deleted when fewer than two members stay open.

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

export interface EntryGroupRepo {
  loadAll(): Promise<EntryGroup[]>;
  createGroup(id: string): Promise<void>;
  setColor(id: string, color: string): Promise<void>;
  upsertMember(groupId: string, member: GroupMember): Promise<void>;
  removeMembers(broker: string, tickets: number[]): Promise<void>;
  deleteGroups(ids: string[]): Promise<void>;
}

type ChangeListener = (groups: EntryGroup[]) => void;

export function pickColor(groups: Iterable<EntryGroup>): string {
  const usage = new Map<string, number>(GROUP_PALETTE.map(c => [c, 0]));
  for (const g of groups) {
    if (usage.has(g.color)) usage.set(g.color, (usage.get(g.color) ?? 0) + 1);
  }
  return GROUP_PALETTE.reduce((best, c) => ((usage.get(c) ?? 0) < (usage.get(best) ?? 0) ? c : best), GROUP_PALETTE[0]);
}

export function createEntryGroupStore(repo: EntryGroupRepo, now: () => number = Date.now) {
  const groups = new Map<string, EntryGroup>();
  const appliedTickets = new Map<string, string>();
  const emptySince = new Map<string, number>();
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

  const isFinished = (g: EntryGroup) => g.members.length === 0 || (g.color !== '' && g.members.length < 2);

  const dropFinished = (candidates: EntryGroup[]): boolean => {
    const finished = candidates.filter(isFinished).map(g => g.id);
    if (finished.length === 0) return false;
    finished.forEach(id => groups.delete(id));
    persist(() => repo.deleteGroups(finished));
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
      const previous = groupOf(broker, ticket);
      if (previous?.id === groupId) return;
      if (previous) {
        previous.members = previous.members.filter(m => m.broker !== broker || m.ticket !== ticket);
        dropFinished([previous]);
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
      notify();
    },

    removeMember(broker: string, ticket: number): boolean {
      const touched = detach(broker, new Set([ticket]));
      if (touched.length === 0) return false;
      persist(() => repo.removeMembers(broker, [ticket]));
      dropFinished(touched);
      notify();
      return true;
    },

    // Called on every positions message; only acts when the broker's open tickets change.
    // An empty list must last EMPTY_LIST_GRACE_MS: an EA reconnecting reports no positions for a moment.
    syncOpenTickets(broker: string, tickets: number[]): void {
      const key = [...tickets].sort((a, b) => a - b).join(',');
      if (appliedTickets.get(broker) === key) return;

      if (tickets.length === 0) {
        const since = emptySince.get(broker);
        if (since === undefined) { emptySince.set(broker, now()); return; }
        if (now() - since < EMPTY_LIST_GRACE_MS) return;
      }
      emptySince.delete(broker);
      appliedTickets.set(broker, key);

      const open = new Set(tickets);
      const closed = new Set<number>();
      for (const g of groups.values()) {
        g.members.forEach(m => { if (m.broker === broker && !open.has(m.ticket)) closed.add(m.ticket); });
      }
      if (closed.size === 0) return;

      const touched = detach(broker, closed);
      persist(() => repo.removeMembers(broker, [...closed]));
      dropFinished(touched);
      notify();
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
