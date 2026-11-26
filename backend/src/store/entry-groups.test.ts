import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/client', () => ({ db: {} }));

import { createEntryGroupStore, pickColor, GROUP_PALETTE, EMPTY_LIST_GRACE_MS, type EntryGroup, type EntryGroupRepo } from './entry-groups';

function memoryRepo(initial: EntryGroup[] = []) {
  const rows = new Map<string, EntryGroup>(initial.map(g => [g.id, structuredClone(g)]));
  const repo: EntryGroupRepo = {
    loadAll: async () => [...rows.values()].map(g => structuredClone(g)),
    createGroup: async id => { if (!rows.has(id)) rows.set(id, { id, color: '', members: [] }); },
    setColor: async (id, color) => { const g = rows.get(id); if (g) g.color = color; },
    upsertMember: async (groupId, member) => {
      for (const g of rows.values()) g.members = g.members.filter(m => m.broker !== member.broker || m.ticket !== member.ticket);
      rows.get(groupId)?.members.push(member);
    },
    removeMembers: async (broker, tickets) => {
      for (const g of rows.values()) g.members = g.members.filter(m => m.broker !== broker || !tickets.includes(m.ticket));
    },
    deleteGroups: async ids => { ids.forEach(id => rows.delete(id)); },
  };
  return { repo, rows };
}

const market = (...tickets: number[]) => tickets.map(ticket => ({ ticket, type: 0 }));
const pending = (...tickets: number[]) => tickets.map(ticket => ({ ticket, type: 2 }));

let clock = 0;
const now = () => clock;

beforeEach(() => { clock = 1_000_000; });

describe('pickColor', () => {
  it('takes the first unused colour, then the least used one', () => {
    expect(pickColor([])).toBe(GROUP_PALETTE[0]);
    expect(pickColor([{ id: 'a', color: GROUP_PALETTE[0], members: [] }])).toBe(GROUP_PALETTE[1]);
    const all = GROUP_PALETTE.map((color, i) => ({ id: `g${i}`, color, members: [] }));
    expect(pickColor([...all, { id: 'x', color: GROUP_PALETTE[0], members: [] }])).toBe(GROUP_PALETTE[1]);
  });
});

describe('entry group store', () => {
  it('gives a colour on the second member, not the first', () => {
    const store = createEntryGroupStore(memoryRepo().repo, now);
    store.addMember('g1', 'ic', 10);
    expect(store.getGroups()[0].color).toBe('');
    store.addMember('g1', 'pp', 20);
    expect(store.getGroups()[0].color).toBe(GROUP_PALETTE[0]);
    store.addMember('g2', 'ic', 11);
    store.addMember('g2', 'pp', 21);
    expect(store.getGroups().find(g => g.id === 'g2')?.color).toBe(GROUP_PALETTE[1]);
  });

  it('keeps a group while one member is open, and deletes it when none is', () => {
    const store = createEntryGroupStore(memoryRepo().repo, now);
    store.addMember('g1', 'ic', 10);
    store.syncOpenEntries('ic', market(10));
    expect(store.getGroups()).toHaveLength(1);

    store.addMember('g1', 'pp', 20);
    store.syncOpenEntries('pp', market(21));
    expect(store.getGroups()[0].members).toEqual([{ broker: 'ic', ticket: 10 }]);
    store.syncOpenEntries('ic', market(11));
    expect(store.getGroups()).toHaveLength(0);
  });

  it('keeps the rest grouped when one of three closes', () => {
    const store = createEntryGroupStore(memoryRepo().repo, now);
    store.addMember('g1', 'ic', 10);
    store.addMember('g1', 'pp', 20);
    store.addMember('g1', 'ft', 30);
    store.syncOpenEntries('ft', market(31));
    expect(store.getGroups()[0].members).toEqual([{ broker: 'ic', ticket: 10 }, { broker: 'pp', ticket: 20 }]);
  });

  it('ignores an empty list until it lasts the grace period', () => {
    const store = createEntryGroupStore(memoryRepo().repo, now);
    store.addMember('g1', 'ic', 10);
    store.addMember('g1', 'pp', 20);
    store.addMember('g1', 'ft', 30);
    store.syncOpenEntries('ic', []);
    clock += EMPTY_LIST_GRACE_MS - 1;
    store.syncOpenEntries('ic', []);
    expect(store.getGroups()[0].members).toHaveLength(3);
    store.syncOpenEntries('ic', market(10));
    clock += EMPTY_LIST_GRACE_MS;
    store.syncOpenEntries('ic', []);
    expect(store.getGroups()[0].members).toHaveLength(3);
    clock += EMPTY_LIST_GRACE_MS;
    store.syncOpenEntries('ic', []);
    expect(store.getGroups()[0].members).toHaveLength(2);
  });

  it('takes an entry out of its group', () => {
    const store = createEntryGroupStore(memoryRepo().repo, now);
    store.addMember('g1', 'ic', 10);
    store.addMember('g1', 'pp', 20);
    store.addMember('g1', 'ft', 30);
    expect(store.removeMember('ft', 30)).toBe(true);
    expect(store.getGroups()[0].members).toHaveLength(2);
    expect(store.removeMember('ft', 30)).toBe(false);
    store.removeMember('pp', 20);
    store.removeMember('ic', 10);
    expect(store.getGroups()).toHaveLength(0);
  });

  it('moves the filled orders of a group to its _f sibling, and later fills join it', () => {
    const store = createEntryGroupStore(memoryRepo().repo, now);
    for (const [broker, ticket] of [['a', 1], ['b', 2], ['c', 3], ['d', 4]] as const) {
      store.addMember('g1', broker, ticket);
      store.syncOpenEntries(broker, pending(ticket));
    }
    const color = store.getGroups()[0].color;
    expect(store.getGroups()).toHaveLength(1);

    store.syncOpenEntries('a', market(1));
    const afterFirst = store.getGroups();
    expect(afterFirst.find(g => g.id === 'g1')?.members).toHaveLength(3);
    expect(afterFirst.find(g => g.id === 'g1_f')).toEqual({ id: 'g1_f', color: '', members: [{ broker: 'a', ticket: 1 }] });

    store.syncOpenEntries('b', market(2));
    store.syncOpenEntries('c', market(3));
    const orders = store.getGroups().find(g => g.id === 'g1');
    const filled = store.getGroups().find(g => g.id === 'g1_f');
    expect(orders).toEqual({ id: 'g1', color, members: [{ broker: 'd', ticket: 4 }] });
    expect(filled?.members).toHaveLength(3);
    expect(filled?.color).not.toBe('');
    expect(filled?.color).not.toBe(color);

    store.syncOpenEntries('d', market(4));
    expect(store.getGroups().map(g => g.id)).toEqual(['g1_f']);
    expect(store.getGroups()[0].members).toHaveLength(4);
  });

  it('does not split a group of positions or one whose brokers have not reported', () => {
    const store = createEntryGroupStore(memoryRepo().repo, now);
    store.addMember('g1', 'a', 1);
    store.addMember('g1', 'b', 2);
    store.syncOpenEntries('a', market(1));
    expect(store.getGroups().map(g => g.id)).toEqual(['g1']);
    store.syncOpenEntries('b', market(2));
    expect(store.getGroups().map(g => g.id)).toEqual(['g1']);
  });

  it('notifies listeners on every change', () => {
    const store = createEntryGroupStore(memoryRepo().repo, now);
    const listener = vi.fn();
    store.onChange(listener);
    store.addMember('g1', 'ic', 10);
    store.addMember('g1', 'pp', 20);
    store.syncOpenEntries('ic', market(10));
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[1][0][0].members).toHaveLength(2);
  });

  it('persists and loads the groups after a restart', async () => {
    const { repo } = memoryRepo();
    const store = createEntryGroupStore(repo, now);
    store.addMember('g1', 'ic', 10);
    store.addMember('g1', 'pp', 20);
    await store.flush();

    const restarted = createEntryGroupStore(repo, now);
    await restarted.load();
    expect(restarted.getGroups()).toEqual([
      { id: 'g1', color: GROUP_PALETTE[0], members: [{ broker: 'ic', ticket: 10 }, { broker: 'pp', ticket: 20 }] },
    ]);
  });
});
