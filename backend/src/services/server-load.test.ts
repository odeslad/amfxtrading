import { describe, it, expect } from 'vitest';
import { cpuPercent, readCpuTimes, readMemory } from './server-load';

describe('cpuPercent', () => {
  it('is the busy share of the time elapsed between two readings', () => {
    expect(cpuPercent({ idle: 1000, total: 4000 }, { idle: 1600, total: 6000 })).toBe(70);
    expect(cpuPercent({ idle: 0, total: 0 }, { idle: 500, total: 500 })).toBe(0);
    expect(cpuPercent({ idle: 500, total: 500 }, { idle: 500, total: 900 })).toBe(100);
    expect(cpuPercent({ idle: 0, total: 0 }, { idle: 2, total: 3 })).toBe(33);
  });

  it('stays within 0 and 100 when the counters are inconsistent', () => {
    expect(cpuPercent({ idle: 0, total: 0 }, { idle: 1200, total: 1000 })).toBe(0);
    expect(cpuPercent({ idle: 900, total: 1000 }, { idle: 800, total: 1100 })).toBe(100);
  });

  it('has no figure when no time elapsed or the counters went back', () => {
    expect(cpuPercent({ idle: 10, total: 100 }, { idle: 10, total: 100 })).toBeNull();
    expect(cpuPercent({ idle: 10, total: 100 }, { idle: 5, total: 50 })).toBeNull();
  });
});

describe('readings of this machine', () => {
  it('adds up every core and never has more idle than total time', () => {
    const times = readCpuTimes();
    expect(times.total).toBeGreaterThan(0);
    expect(times.idle).toBeLessThanOrEqual(times.total);
  });

  it('reports memory in MB with free below total', () => {
    const { freeMemMb, totalMemMb } = readMemory();
    expect(totalMemMb).toBeGreaterThan(0);
    expect(freeMemMb).toBeGreaterThanOrEqual(0);
    expect(freeMemMb).toBeLessThanOrEqual(totalMemMb);
  });
});
