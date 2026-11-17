import { describe, it, expect } from 'vitest';
import type { BrokerLiveness } from '../store/liveness';
import { brokerStatus, emptyTracker, nextStatus, THRESHOLDS, type Level, type StatusSample, type StatusTracker } from './system-status';

const now = new Date('2026-11-17T10:00:00Z');
const secondsAgo = (s: number): Date => new Date(now.getTime() - s * 1000);

const broker = (over: Partial<BrokerLiveness> = {}): BrokerLiveness => ({
  pipe: 'connected', pipeLostAt: null, eaStatus: null,
  lastTickAt: now, lastSyncAt: now, watcher: true, ...over,
});

const lost = (seconds: number): BrokerLiveness =>
  broker({ pipe: 'listening', pipeLostAt: secondsAgo(seconds), lastTickAt: secondsAgo(seconds) });

const loading = (delayS = 0): BrokerLiveness => broker({
  lastTickAt: secondsAgo(delayS),
  eaStatus: { version: '3.17', loading: true, loadDone: 12, loadTotal: 75 },
});

const sample = (over: Partial<StatusSample> & { entries?: Record<string, BrokerLiveness> } = {}): StatusSample => {
  const { entries = { darwinex: broker() }, ...rest } = over;
  return {
    now, brokers: new Map(Object.entries(entries)), hiddenBrokers: [],
    cpuPct: 20, memory: { freeMemMb: 4000, totalMemMb: 8000 }, ...rest,
  };
};

const run = (samples: StatusSample[], from: StatusTracker = emptyTracker()): StatusTracker =>
  samples.reduce(nextStatus, from);

// The same sample twice: the level it settles on once it has held.
const settled = (s: StatusSample): Level | undefined => run([s, s]).status?.level;

describe('brokerStatus', () => {
  it('is connected with its tick delay, or loading with the EA progress', () => {
    expect(brokerStatus('a', broker({ lastTickAt: secondsAgo(3) }), now))
      .toEqual({ name: 'a', state: 'connected', level: 'ok', tickDelayS: 3 });
    expect(brokerStatus('a', loading(21), now))
      .toEqual({ name: 'a', state: 'loading', level: 'warn', tickDelayS: 21, loadDone: 12, loadTotal: 75 });
    expect(brokerStatus('a', broker({ eaStatus: { version: '3.17', loading: false, loadDone: 75, loadTotal: 75 } }), now).state)
      .toBe('connected');
  });

  it('is restarting inside the grace period and disconnected after it', () => {
    expect(brokerStatus('a', lost(THRESHOLDS.pipeGraceS - 1), now))
      .toEqual({ name: 'a', state: 'restarting', level: 'warn', tickDelayS: null, disconnectedS: 119 });
    expect(brokerStatus('a', lost(THRESHOLDS.pipeGraceS), now).state).toBe('disconnected');
    expect(brokerStatus('a', broker({ pipe: 'error', pipeLostAt: secondsAgo(240) }), now))
      .toEqual({ name: 'a', state: 'disconnected', level: 'bad', tickDelayS: null, disconnectedS: 240 });
  });

  it('counts a disabled pipe as connected, with no delay to report', () => {
    expect(brokerStatus('a', broker({ pipe: 'disabled', lastTickAt: null }), now))
      .toEqual({ name: 'a', state: 'connected', level: 'ok', tickDelayS: null });
  });
});

describe('level', () => {
  it('is ok with every broker connected and the server at rest', () => {
    const { status } = run([sample()]);
    expect(status).toEqual({
      level: 'ok',
      server: { cpuPct: 20, freeMemMb: 4000, totalMemMb: 8000 },
      brokers: [{ name: 'darwinex', state: 'connected', level: 'ok', tickDelayS: 0 }],
      at: now.toISOString(),
    });
  });

  it('follows the broker state: loading or restarting warn, disconnected is bad', () => {
    expect(settled(sample({ entries: { a: broker(), b: loading() } }))).toBe('warn');
    expect(settled(sample({ entries: { a: broker(), b: lost(30) } }))).toBe('warn');
    expect(settled(sample({ entries: { a: loading(), b: lost(120) } }))).toBe('bad');
  });

  it('follows the tick delay of a connected broker: 5 s warns, 60 s is bad', () => {
    const delayed = (s: number) => sample({ entries: { a: broker({ lastTickAt: secondsAgo(s) }) } });
    expect(settled(delayed(4))).toBe('ok');
    expect(settled(delayed(5))).toBe('warn');
    expect(settled(delayed(59))).toBe('warn');
    expect(settled(delayed(60))).toBe('bad');
    expect(settled(sample({ entries: { a: loading(60) } }))).toBe('bad');
  });

  it('follows the CPU average: 85 % over 15 s warns, 95 % over 60 s is bad', () => {
    const cpu = (pct: number, times: number) => Array.from({ length: times }, () => sample({ cpuPct: pct }));
    expect(run(cpu(100, 2)).status?.level).toBe('ok');
    expect(run(cpu(84, 12)).status?.level).toBe('ok');
    expect(run(cpu(85, 4)).status?.level).toBe('warn');
    expect(run(cpu(100, 12)).status?.level).toBe('warn');
    expect(run(cpu(95, 13)).status?.level).toBe('bad');
    expect(run([...cpu(10, 12), ...cpu(100, 2), ...cpu(10, 3)]).status?.level).toBe('ok');
  });

  it('keeps the last CPU figures when a reading is missing', () => {
    const busy = run(Array.from({ length: 4 }, () => sample({ cpuPct: 90 })));
    const after = nextStatus(busy, sample({ cpuPct: null }));
    expect(after.cpuSamples).toEqual(busy.cpuSamples);
    expect(after.status?.server.cpuPct).toBeNull();
    expect(after.status?.level).toBe('warn');
  });

  it('follows the free memory: under 10 % warns, under 5 % is bad', () => {
    const free = (mb: number) => sample({ memory: { freeMemMb: mb, totalMemMb: 8000 } });
    expect(settled(free(800))).toBe('ok');
    expect(settled(free(799))).toBe('warn');
    expect(settled(free(400))).toBe('warn');
    expect(settled(free(399))).toBe('bad');
  });

  it('takes the worst of all the rules', () => {
    expect(settled(sample({
      entries: { a: loading(), b: lost(300) },
      memory: { freeMemMb: 700, totalMemMb: 8000 },
    }))).toBe('bad');
  });
});

describe('two consecutive samples', () => {
  const ok = sample();
  const warn = sample({ entries: { a: loading() } });
  const bad = sample({ entries: { a: lost(300) } });
  const levels = (samples: StatusSample[]): (Level | undefined)[] =>
    samples.map((_, i) => run(samples.slice(0, i + 1)).status?.level);

  it('publishes the first sample as it is', () => {
    expect(run([bad]).status?.level).toBe('bad');
  });

  it('does not change the level for a single spike, in either direction', () => {
    expect(levels([ok, ok, bad, ok, ok])).toEqual(['ok', 'ok', 'ok', 'ok', 'ok']);
    expect(levels([bad, bad, ok, bad])).toEqual(['bad', 'bad', 'bad', 'bad']);
  });

  it('changes once the new level has held for two samples', () => {
    expect(levels([ok, ok, warn, warn, bad, bad, ok, ok])).toEqual(['ok', 'ok', 'ok', 'warn', 'warn', 'bad', 'bad', 'ok']);
  });

  it('moves only as far as both samples agree', () => {
    expect(levels([ok, ok, warn, bad])).toEqual(['ok', 'ok', 'ok', 'warn']);
    expect(levels([bad, bad, warn, ok])).toEqual(['bad', 'bad', 'bad', 'warn']);
  });

  it('still lists the brokers as they are right now', () => {
    expect(run([ok, bad]).status?.brokers[0].state).toBe('disconnected');
  });
});

describe('hidden brokers', () => {
  it('leaves them out of the level and of the list', () => {
    const hidden = sample({ entries: { a: broker(), isa: lost(900) }, hiddenBrokers: ['isa'] });
    const { status } = run([hidden, hidden]);
    expect(status?.level).toBe('ok');
    expect(status?.brokers.map(b => b.name)).toEqual(['a']);
  });
});
