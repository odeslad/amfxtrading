import { describe, it, expect } from 'vitest';
import {
  healthReport, register, setPipeState, setEaStatus, parseEaStatus, touchTick, touchSync, snapshot, pipeStateOf, isPipeLive,
  type BrokerLiveness,
} from './liveness';

const now = new Date('2026-10-02T10:00:00Z');
const startedAt = new Date('2026-10-02T08:33:20Z');
const secondsAgo = (s: number): Date => new Date(now.getTime() - s * 1000);

const broker = (over: Partial<BrokerLiveness> = {}): BrokerLiveness => ({
  pipe: 'connected', pipeLostAt: null, eaStatus: null,
  lastTickAt: secondsAgo(2), lastSyncAt: secondsAgo(14), watcher: true, ...over,
});

const report = (entries: Record<string, BrokerLiveness>) =>
  healthReport(now, startedAt, new Map(Object.entries(entries)));

describe('healthReport', () => {
  it('is ok when every broker is connected with a fresh tick, and formats ages and uptime', () => {
    const r = report({ darwinex: broker(), ftmo: broker({ lastTickAt: secondsAgo(299) }) });
    expect(r.status).toBe('ok');
    expect(r.uptimeS).toBe(5200);
    expect(r.brokers[0]).toEqual({
      name: 'darwinex', pipe: 'connected',
      lastTickAt: secondsAgo(2).toISOString(), lastSyncAt: secondsAgo(14).toISOString(),
      tickAgeS: 2, syncAgeS: 14,
    });
  });

  it('degrades when a pipe is not connected', () => {
    expect(report({ a: broker(), b: broker({ pipe: 'listening' }) }).status).toBe('degraded');
    expect(report({ a: broker({ pipe: 'error' }) }).status).toBe('degraded');
  });

  it('degrades when the last tick is older than 5 minutes or never arrived', () => {
    expect(report({ a: broker({ lastTickAt: secondsAgo(301) }) }).status).toBe('degraded');
    const never = report({ a: broker({ lastTickAt: null }) });
    expect(never.status).toBe('degraded');
    expect(never.brokers[0].tickAgeS).toBeNull();
    expect(never.brokers[0].lastTickAt).toBeNull();
  });

  it('ignores disabled pipes and a missing sync', () => {
    const r = report({ a: broker({ pipe: 'disabled', lastTickAt: null, lastSyncAt: null, watcher: false }) });
    expect(r.status).toBe('ok');
    expect(r.brokers[0]).toMatchObject({ pipe: 'disabled', tickAgeS: null, syncAgeS: null });
  });

  it('never reports a negative age', () => {
    expect(report({ a: broker({ lastTickAt: secondsAgo(-3) }) }).brokers[0].tickAgeS).toBe(0);
  });
});

describe('store', () => {
  it('registers brokers by feature flags and records state and timestamps', () => {
    register('x', { pipe: true, watcher: true }, startedAt);
    register('y', { pipe: false, watcher: false }, startedAt);
    expect(snapshot().get('x')).toEqual({
      pipe: 'listening', pipeLostAt: startedAt, eaStatus: null, lastTickAt: null, lastSyncAt: null, watcher: true,
    });
    expect(snapshot().get('y')).toMatchObject({ pipe: 'disabled', pipeLostAt: null });

    setPipeState('x', 'connected');
    touchTick('x', now);
    touchSync('x', now);
    expect(snapshot().get('x')).toEqual({
      pipe: 'connected', pipeLostAt: null, eaStatus: null, lastTickAt: now, lastSyncAt: now, watcher: true,
    });
  });

  it('times the loss of a pipe from its first moment and forgets the EA status with it', () => {
    const status = { version: '3.17', loading: true, loadDone: 12, loadTotal: 75 };
    register('z', { pipe: true, watcher: false }, startedAt);
    setPipeState('z', 'connected', now);
    setEaStatus('z', status);
    expect(snapshot().get('z')).toMatchObject({ pipeLostAt: null, eaStatus: status });

    setPipeState('z', 'listening', secondsAgo(-10));
    setPipeState('z', 'error', secondsAgo(-40));
    expect(snapshot().get('z')).toMatchObject({ pipe: 'error', pipeLostAt: secondsAgo(-10), eaStatus: null });

    setPipeState('z', 'connected', secondsAgo(-60));
    expect(snapshot().get('z')?.pipeLostAt).toBeNull();
    setEaStatus('nobody', status);
    expect(snapshot().has('nobody')).toBe(false);
  });

  it('tells live pipes apart: connected or disabled, never listening or error', () => {
    expect(isPipeLive('connected')).toBe(true);
    expect(isPipeLive('disabled')).toBe(true);
    expect(isPipeLive('listening')).toBe(false);
    expect(isPipeLive('error')).toBe(false);
    expect(pipeStateOf('x')).toBe('connected');
    expect(pipeStateOf('y')).toBe('disabled');
    expect(pipeStateOf('nobody')).toBeNull();
  });

  it('ignores unknown brokers and hands out copies', () => {
    touchTick('nobody');
    expect(snapshot().has('nobody')).toBe(false);
    const copy = snapshot().get('x')!;
    copy.pipe = 'error';
    expect(snapshot().get('x')?.pipe).toBe('connected');
  });
});

describe('parseEaStatus', () => {
  it('keeps the four fields of a well-formed status and drops the rest', () => {
    expect(parseEaStatus({ type: 'status', version: '3.17', loading: true, loadDone: 12, loadTotal: 75 }))
      .toEqual({ version: '3.17', loading: true, loadDone: 12, loadTotal: 75 });
  });

  it('rejects a status with missing, mistyped or impossible fields', () => {
    const ok = { version: '3.17', loading: false, loadDone: 75, loadTotal: 75 };
    expect(parseEaStatus(null)).toBeNull();
    expect(parseEaStatus('status')).toBeNull();
    expect(parseEaStatus({ ...ok, version: 3.17 })).toBeNull();
    expect(parseEaStatus({ ...ok, loading: 'true' })).toBeNull();
    expect(parseEaStatus({ ...ok, loadDone: -1 })).toBeNull();
    expect(parseEaStatus({ ...ok, loadDone: 1.5 })).toBeNull();
    expect(parseEaStatus({ ...ok, loadDone: 76 })).toBeNull();
    expect(parseEaStatus({ version: '3.17', loading: false })).toBeNull();
  });
});
