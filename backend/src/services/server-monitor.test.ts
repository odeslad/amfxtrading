import { describe, it, expect, vi, beforeEach } from 'vitest';
import type os from 'os';

vi.mock('../db/client', () => ({ db: {} }));

import { ServerMonitor, cpuPercent, cpuTimes, average, parseProbe, KEEP_MS, type MonitorDeps } from './server-monitor';

const NOW = new Date(Date.UTC(2026, 10, 19, 12, 0, 0));
const GB = 1024 ** 3;

const cpu = (idle: number, busy: number): os.CpuInfo =>
  ({ model: 'x', speed: 2000, times: { user: busy, nice: 0, sys: 0, idle, irq: 0 } });

const probeJson = (extra: Record<string, unknown> = {}) => JSON.stringify({
  host: 'WIN-XL', os: 'Windows Server 2025', bootAt: '2026-11-19T10:31:59.5Z',
  pageFileMb: 900, diskFreeGb: 448.9, diskTotalGb: 479.4,
  services: [{ name: 'nginx', state: 'running' }],
  terminals: [{ broker: 'demo', running: true, memMb: 30 }, { broker: 'FTMO', running: false, memMb: null }],
  ...extra,
});

describe('cpuPercent', () => {
  it('is the busy share of the time between two readings, over all cores', () => {
    const a = cpuTimes([cpu(100, 0), cpu(100, 0)]);
    const b = cpuTimes([cpu(190, 10), cpu(160, 40)]);
    expect(cpuPercent(a, b)).toBe(25);
  });

  it('gives nothing when no time passed', () => {
    const a = cpuTimes([cpu(100, 0)]);
    expect(cpuPercent(a, a)).toBeNull();
  });
});

describe('average', () => {
  it('rounds to one decimal and is null without values', () => {
    expect(average([10, 11, 12.5])).toBe(11.2);
    expect(average([])).toBeNull();
  });
});

describe('parseProbe', () => {
  it('reads the probe output', () => {
    const p = parseProbe(probeJson());
    expect(p?.host).toBe('WIN-XL');
    expect(p?.terminals).toEqual([{ broker: 'demo', running: true, memMb: 30 }, { broker: 'FTMO', running: false, memMb: null }]);
    expect(p?.events).toBeUndefined();
  });

  it('turns a single object PowerShell printed for a one-item list into a list', () => {
    const p = parseProbe(probeJson({ services: { name: 'sshd', state: 'stopped' }, events: { at: '2026-11-18T15:14:00Z', kind: 'bugcheck', code: '0x1A', param1: '0x3F' } }));
    expect(p?.services).toEqual([{ name: 'sshd', state: 'stopped' }]);
    expect(p?.events).toEqual([{ at: '2026-11-18T15:14:00Z', kind: 'bugcheck', code: '0x1A', param1: '0x3F' }]);
  });

  it('reads an empty event list and the restart count', () => {
    const p = parseProbe(probeJson({ events: null, backendRestarts: 3 }));
    expect(p?.events).toEqual([]);
    expect(p?.backendRestarts).toBe(3);
  });

  it('rejects broken or foreign output', () => {
    expect(parseProbe('{"host":')).toBeNull();
    expect(parseProbe('Access is denied.')).toBeNull();
    expect(parseProbe('{"foo":1}')).toBeNull();
  });
});

describe('ServerMonitor', () => {
  let cpus: os.CpuInfo[];
  let deps: MonitorDeps;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    cpus = [cpu(100, 0), cpu(100, 0)];
    deps = {
      runProbe: vi.fn().mockResolvedValue(probeJson()),
      readCpus: () => cpus,
      memory: () => ({ total: 16 * GB, free: 12 * GB }),
      now: () => NOW,
      save: vi.fn().mockResolvedValue(undefined),
      prune: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('keeps CPU and memory of the last fast sample', () => {
    const m = new ServerMonitor(deps);
    cpus = [cpu(190, 10), cpu(160, 40)];
    m.sampleFast();
    expect(m.snapshot()).toMatchObject({ cores: 2, cpu: 25, memTotalMb: 16384, memUsedMb: 4096, fastAt: NOW });
  });

  it('writes one row a minute with the average CPU of its fast samples and the probe figures', async () => {
    const m = new ServerMonitor(deps);
    await m.probe(false);
    cpus = [cpu(190, 10), cpu(160, 40)]; m.sampleFast();   // 25 %
    cpus = [cpu(280, 20), cpu(220, 80)]; m.sampleFast();   // 25 % (+90/+10, +60/+40)
    cpus = [cpu(300, 100), cpu(240, 160)]; m.sampleFast(); // 80 %
    await m.saveMinute();
    expect(deps.save).toHaveBeenCalledWith({ time: NOW, cpu: 43.3, memUsedMb: 4096, memTotalMb: 16384, pageFileMb: 900, terminals: 1 });
    await m.saveMinute();
    expect(deps.save).toHaveBeenLastCalledWith(expect.objectContaining({ cpu: 80 }));
  });

  it('writes no row before the first CPU reading, and nulls before the first probe', async () => {
    const m = new ServerMonitor(deps);
    await m.saveMinute();
    expect(deps.save).not.toHaveBeenCalled();
    cpus = [cpu(190, 10), cpu(160, 40)]; m.sampleFast();
    await m.saveMinute();
    expect(deps.save).toHaveBeenCalledWith(expect.objectContaining({ pageFileMb: null, terminals: null }));
  });

  it('keeps the previous probe when one fails or prints something else', async () => {
    const m = new ServerMonitor(deps);
    await m.probe(true);
    const first = m.snapshot();
    vi.mocked(deps.runProbe).mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce('garbage');
    await m.probe(false);
    await m.probe(false);
    expect(m.snapshot().probe).toEqual(first.probe);
    expect(m.snapshot().probeAt).toEqual(first.probeAt);
  });

  it('takes events and restarts only from an events run', async () => {
    vi.mocked(deps.runProbe)
      .mockResolvedValueOnce(probeJson({ events: [{ at: '2026-11-18T15:14:00Z', kind: 'unexpected', code: null, param1: null }], backendRestarts: 2 }))
      .mockResolvedValueOnce(probeJson());
    const m = new ServerMonitor(deps);
    await m.probe(true);
    await m.probe(false);
    expect(m.snapshot().events).toHaveLength(1);
    expect(m.snapshot().backendRestarts).toBe(2);
  });

  it('deletes rows older than 7 days', async () => {
    await new ServerMonitor(deps).prune();
    expect(deps.prune).toHaveBeenCalledWith(new Date(NOW.getTime() - KEEP_MS));
  });

  it('survives a database error when saving', async () => {
    vi.mocked(deps.save).mockRejectedValueOnce(new Error('db down'));
    const m = new ServerMonitor(deps);
    cpus = [cpu(190, 10), cpu(160, 40)]; m.sampleFast();
    await expect(m.saveMinute()).resolves.toBeUndefined();
  });
});
