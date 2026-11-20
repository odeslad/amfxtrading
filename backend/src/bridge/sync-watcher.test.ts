import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const { db } = vi.hoisted(() => {
  const db = {
    candleSync: { findMany: vi.fn(), update: vi.fn() },
    candle: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  };
  return { db };
});
vi.mock('../db/client', () => ({ db }));

import { SyncWatcher, parseStatus, STALL_MS } from './sync-watcher';

let bridge = '';
const NOW = Date.UTC(2026, 10, 18, 12, 0, 0);
const broadcast = vi.fn();

const row = (timeframe: string, state: string, extra: Record<string, unknown> = {}) => ({
  broker: 'demo', timeframe, target: 10000, candleCount: 900, lastSyncAt: null, state, detail: null,
  requestId: 'req-1', updatedAt: new Date(NOW), ...extra,
});

const writeStatus = (status: object) =>
  fs.writeFileSync(path.join(bridge, 'sync-status.json'), JSON.stringify(status));

const writeCandles = (symbol: string, tf: string, count: number) => {
  fs.mkdirSync(path.join(bridge, 'sync'), { recursive: true });
  const candles = Array.from({ length: count }, (_, i) => ({ time: 1_700_000_000 + i * 300, open: 1, high: 2, low: 0.5, close: 1.5 }));
  fs.writeFileSync(path.join(bridge, 'sync', `${symbol}_${tf}.json`), JSON.stringify({ brokerOffset: 7200, candles }));
};

const watcher = () => new SyncWatcher('demo', bridge, broadcast, () => NOW);

beforeEach(() => {
  vi.clearAllMocks();
  bridge = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-watcher-'));
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<void>) => fn(db));
  db.candleSync.findMany.mockResolvedValue([]);
});

afterEach(() => fs.rmSync(bridge, { recursive: true, force: true }));

describe('parseStatus', () => {
  it('reads a valid status and ignores a broken or unknown one', () => {
    expect(parseStatus('{"id":"a","state":"running","timeframe":"M5","symbol":"EURUSD","done":3,"total":15}'))
      .toEqual({ id: 'a', state: 'running', timeframe: 'M5', symbol: 'EURUSD', done: 3, total: 15, message: undefined });
    expect(parseStatus('{"id":"a","state":"paused"}')).toBeNull();
    expect(parseStatus('{"id":')).toBeNull();
  });
});

describe('SyncWatcher', () => {
  it('shows the running symbol and progress of a timeframe', async () => {
    db.candleSync.findMany.mockResolvedValueOnce([row('M5', 'queued')]);
    writeStatus({ id: 'req-1', state: 'running', timeframe: 'M5', symbol: 'GBPJPY', done: 7, total: 15 });
    await watcher().poll();
    expect(db.candleSync.update).toHaveBeenCalledWith({
      where: { broker_timeframe: { broker: 'demo', timeframe: 'M5' } },
      data: { state: 'running', detail: 'GBPJPY 7/15' },
    });
    expect(broadcast).toHaveBeenCalledWith('demo', expect.objectContaining({ timeframe: 'M5', state: 'running', done: 7, total: 15 }));
  });

  it('replaces the pair in one transaction when a timeframe is complete', async () => {
    db.candleSync.findMany.mockResolvedValueOnce([row('M5', 'running')]);
    writeCandles('EURUSD', 'M5', 10000);
    writeCandles('GBPUSD', 'M5', 6212);
    writeCandles('EURUSD', 'D1', 50);
    writeStatus({ id: 'req-1', state: 'complete', timeframe: 'M5' });
    await watcher().poll();

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.candle.deleteMany).toHaveBeenCalledWith({ where: { broker: 'demo', timeframe: 'M5', symbol: { in: ['EURUSD', 'GBPUSD'] } } });
    const inserted = db.candle.createMany.mock.calls.reduce((n, [arg]) => n + (arg as { data: unknown[] }).data.length, 0);
    expect(inserted).toBe(16212);
    expect(db.candleSync.update).toHaveBeenCalledWith({
      where: { broker_timeframe: { broker: 'demo', timeframe: 'M5' } },
      data: { state: 'done', detail: '2 symbols · 16212 candles', candleCount: 6212, lastSyncAt: new Date(NOW) },
    });
    expect(fs.readdirSync(path.join(bridge, 'sync'))).toEqual(['EURUSD_D1.json']);
  });

  it('keeps the previous history when the swap fails, and reports the error', async () => {
    db.candleSync.findMany.mockResolvedValueOnce([row('M5', 'running')]);
    db.$transaction.mockRejectedValueOnce(new Error('disk full'));
    writeCandles('EURUSD', 'M5', 100);
    writeStatus({ id: 'req-1', state: 'complete', timeframe: 'M5' });
    await watcher().poll();

    expect(db.candleSync.update).toHaveBeenCalledWith({
      where: { broker_timeframe: { broker: 'demo', timeframe: 'M5' } },
      data: { state: 'error', detail: 'disk full' },
    });
    expect(broadcast).toHaveBeenCalledWith('demo', expect.objectContaining({ state: 'error', candleCount: 900 }));
  });

  it('reports an error and deletes nothing when the EA delivered no files', async () => {
    db.candleSync.findMany.mockResolvedValueOnce([row('H1', 'running')]);
    writeStatus({ id: 'req-1', state: 'complete', timeframe: 'H1' });
    await watcher().poll();
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.candleSync.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { state: 'error', detail: 'The EA delivered no candles' },
    }));
  });

  it('turns every busy timeframe of the request into an error when the EA reports one', async () => {
    db.candleSync.findMany
      .mockResolvedValueOnce([row('M5', 'running'), row('H1', 'queued')])
      .mockResolvedValueOnce([row('M5', 'running'), row('H1', 'queued')]);
    writeStatus({ id: 'req-1', state: 'error', message: 'chart could not open' });
    await watcher().poll();
    expect(db.candleSync.update).toHaveBeenCalledTimes(2);
    expect(db.candleSync.update).toHaveBeenCalledWith(expect.objectContaining({ data: { state: 'error', detail: 'chart could not open' } }));
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('ignores a status from an older request and the same status twice', async () => {
    writeStatus({ id: 'old', state: 'complete', timeframe: 'M5' });
    const w = watcher();
    await w.poll();
    await w.poll();
    expect(db.candleSync.findMany).toHaveBeenCalledTimes(3);   // one lookup, two stall checks
    expect(db.candleSync.update).not.toHaveBeenCalled();
  });

  it('does not fail queued timeframes while the EA keeps writing progress (FTMO, 18 Nov)', async () => {
    let clock = NOW;
    const w = new SyncWatcher('demo', bridge, broadcast, () => clock);
    const queuedLongAgo = row('D1', 'queued', { updatedAt: new Date(NOW - 20 * 60_000) });
    db.candleSync.findMany.mockResolvedValue([queuedLongAgo]);
    writeStatus({ id: 'req-1', state: 'running', timeframe: 'H4', symbol: 'EURUSD', done: 1, total: 15 });
    await w.poll();
    clock = NOW + 60_000;
    await w.poll();
    expect(db.candleSync.update).not.toHaveBeenCalled();
  });

  it('takes away the files of a cancelled request so the EA moves on', async () => {
    db.candleSync.findMany.mockResolvedValueOnce([row('H4', 'error')]);
    writeCandles('EURUSD', 'H4', 10);
    writeCandles('EURUSD', 'D1', 10);
    writeStatus({ id: 'req-1', state: 'complete', timeframe: 'H4' });
    await watcher().poll();
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(fs.readdirSync(path.join(bridge, 'sync'))).toEqual(['EURUSD_D1.json']);
  });

  it('fails a sync with no change for 5 minutes and withdraws the command', async () => {
    fs.writeFileSync(path.join(bridge, 'sync-command.json'), '{}');
    const stale = row('M5', 'queued', { updatedAt: new Date(NOW - STALL_MS) });
    db.candleSync.findMany.mockResolvedValueOnce([stale]).mockResolvedValueOnce([stale]);
    await watcher().poll();
    expect(fs.existsSync(path.join(bridge, 'sync-command.json'))).toBe(false);
    expect(db.candleSync.update).toHaveBeenCalledWith({
      where: { broker_timeframe: { broker: 'demo', timeframe: 'M5' } },
      data: { state: 'error', detail: 'The EA stopped answering (5 min)' },
    });
  });
});
