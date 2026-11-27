import { describe, it, expect, vi } from 'vitest';

vi.mock('../db/client', () => ({ db: {} }));

import { brokerDayStart, createClosedToday } from './closed-today';

const HOUR = 3600;
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

function setup(start = Date.UTC(2026, 10, 27, 10, 0, 0)) {
  let clock = start;
  const calls: { broker: string; from: Date }[] = [];
  let next = 12.5;
  const aggregate = vi.fn(async (broker: string, from: Date) => { calls.push({ broker, from }); return next; });
  const store = createClosedToday(aggregate, () => clock, () => {});
  return {
    store, calls, aggregate,
    setNext: (v: number) => { next = v; },
    advance: (ms: number) => { clock += ms; },
  };
}

describe('brokerDayStart', () => {
  it('is the broker\x27s midnight as a UTC instant', () => {
    const now = Date.UTC(2026, 10, 27, 23, 30, 0);
    expect(brokerDayStart(now, 0)).toBe(Date.UTC(2026, 10, 27));
    // UTC+2: 01:30 of the 28th in broker time
    expect(brokerDayStart(now, 2 * HOUR)).toBe(Date.UTC(2026, 10, 27, 22));
  });
});

describe('closed today', () => {
  it('answers null the first time, then the computed value without a new aggregate', async () => {
    const { store, aggregate } = setup();
    expect(store.get('ic', 0)).toBeNull();
    await flush();
    expect(store.get('ic', 0)).toBe(12.5);
    expect(store.get('ic', 0)).toBe(12.5);
    expect(aggregate).toHaveBeenCalledTimes(1);
  });

  it('recomputes after a history with changes', async () => {
    const { store, aggregate, setNext } = setup();
    store.get('ic', 0);
    await flush();
    setNext(40);
    await store.refresh('ic', 0);
    expect(store.get('ic', 0)).toBe(40);
    expect(aggregate).toHaveBeenCalledTimes(2);
  });

  it('starts again on the broker\x27s new day', async () => {
    const { store, calls, advance, setNext } = setup();
    store.get('ic', 0);
    await flush();
    advance(14 * HOUR * 1000);
    setNext(0);
    expect(store.get('ic', 0)).toBeNull();
    await flush();
    expect(store.get('ic', 0)).toBe(0);
    expect(calls[1].from.toISOString()).toBe('2026-11-28T00:00:00.000Z');
  });

  it('runs one aggregate at a time per broker and once more for a request meanwhile', async () => {
    const { store, aggregate } = setup();
    const first = store.refresh('ic', 0);
    void store.refresh('ic', 0);
    void store.refresh('ic', 0);
    await first;
    await flush();
    expect(aggregate).toHaveBeenCalledTimes(2);
  });

  it('does not recompute when the offset drifts by a few seconds', async () => {
    const { store, aggregate } = setup();
    store.get('ic', 2 * HOUR);
    await flush();
    for (const drift of [-3, 1, 7, -12, 2]) expect(store.get('ic', 2 * HOUR + drift)).toBe(12.5);
    expect(aggregate).toHaveBeenCalledTimes(1);
    expect(brokerDayStart(Date.UTC(2026, 10, 27, 23, 30), 2 * HOUR - 4)).toBe(Date.UTC(2026, 10, 27, 22));
  });

  it('keeps each broker apart', async () => {
    const { store, calls } = setup();
    store.get('ic', 0);
    store.get('ft', 2 * HOUR);
    await flush();
    expect(calls.map(c => c.broker)).toEqual(['ic', 'ft']);
  });
});
