import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileWatcher, type BridgeTrade } from './file-watcher';

vi.mock('../store/liveness', () => ({ touchSync: vi.fn() }));

let dir: string;
let tick = 0;

const write = (name: string, content: unknown) => {
  const file = path.join(dir, name);
  fs.writeFileSync(file, JSON.stringify(content));
  // A distinct mtime per write, as the EA's rewrites are seconds apart.
  tick += 10;
  const time = new Date(Date.UTC(2026, 9, 29, 0, 0, tick));
  fs.utimesSync(file, time, time);
};

const poll = (watcher: FileWatcher): Promise<void> =>
  (watcher as unknown as { poll(): Promise<void> }).poll();

const trade = (ticket: number) => ({ ticket, type: 0, profit: 10 }) as unknown as BridgeTrade;

describe('FileWatcher history and account', () => {
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fw-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('polls every 5 s by default', () => {
    expect((new FileWatcher('b', dir) as unknown as { intervalMs: number }).intervalMs).toBe(5_000);
  });

  it('hands an unchanged history only once, even when the EA rewrites the same content', async () => {
    const watcher = new FileWatcher('b', dir);
    const handler = vi.fn().mockResolvedValue(undefined);
    watcher.onHistory(handler);
    write('history.json', [trade(1)]);
    await poll(watcher);
    await poll(watcher);
    write('history.json', [trade(1)]);
    await poll(watcher);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('hands a history whose content changed', async () => {
    const watcher = new FileWatcher('b', dir);
    const handler = vi.fn().mockResolvedValue(undefined);
    watcher.onHistory(handler);
    write('history.json', [trade(1)]);
    await poll(watcher);
    write('history.json', [trade(1), trade(2)]);
    await poll(watcher);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[1][0]).toHaveLength(2);
  });

  it('retries a history whose handler failed', async () => {
    const watcher = new FileWatcher('b', dir);
    const handler = vi.fn().mockRejectedValueOnce(new Error('db down')).mockResolvedValue(undefined);
    watcher.onHistory(handler);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    write('history.json', [trade(1)]);
    await poll(watcher);
    await poll(watcher);
    await poll(watcher);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('skips an unchanged account the same way', async () => {
    const watcher = new FileWatcher('b', dir);
    const handler = vi.fn().mockResolvedValue(undefined);
    watcher.onAccount(handler);
    write('account.json', { balance: 100 });
    await poll(watcher);
    write('account.json', { balance: 100 });
    await poll(watcher);
    write('account.json', { balance: 120 });
    await poll(watcher);
    expect(handler.mock.calls.map(c => c[0].balance)).toEqual([100, 120]);
  });
});

describe('FileWatcher full candle history', () => {
  const candles = { brokerOffset: 7200, candles: [{ time: 100, open: 1, high: 2, low: 0.5, close: 1.5 }, { time: 200, open: 1, high: 2, low: 0.5, close: 1.5 }] };

  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fw-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('hands a full history once, with its symbol and timeframe, and removes the file', async () => {
    const watcher = new FileWatcher('b', dir);
    const full = vi.fn().mockResolvedValue(undefined);
    const recent = vi.fn().mockResolvedValue(undefined);
    watcher.onFullCandles(full);
    watcher.onCandles(recent);
    write('fullcandles_EURUSD_M15.json', candles);
    await poll(watcher);
    await poll(watcher);
    expect(full).toHaveBeenCalledTimes(1);
    expect(full.mock.calls[0][0]).toMatchObject({ symbol: 'EURUSD', timeframe: 'M15', brokerOffset: 7200 });
    expect(recent).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(dir, 'fullcandles_EURUSD_M15.json'))).toBe(false);
  });

  it('keeps the file when storing it failed and retries on the next poll', async () => {
    const watcher = new FileWatcher('b', dir);
    const full = vi.fn().mockRejectedValueOnce(new Error('db down')).mockResolvedValue(undefined);
    watcher.onFullCandles(full);
    write('fullcandles_EURUSD_H1.json', candles);
    await poll(watcher);
    expect(fs.existsSync(path.join(dir, 'fullcandles_EURUSD_H1.json'))).toBe(true);
    await poll(watcher);
    expect(full).toHaveBeenCalledTimes(2);
    expect(fs.existsSync(path.join(dir, 'fullcandles_EURUSD_H1.json'))).toBe(false);
  });

  it('ignores the temporary file the EA is still writing', async () => {
    const watcher = new FileWatcher('b', dir);
    const full = vi.fn().mockResolvedValue(undefined);
    watcher.onFullCandles(full);
    write('fullcandles_EURUSD_H1.json.tmp', candles);
    await poll(watcher);
    expect(full).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(dir, 'fullcandles_EURUSD_H1.json.tmp'))).toBe(true);
  });

  it('still hands the recent candle file to its own handler', async () => {
    const watcher = new FileWatcher('b', dir);
    const full = vi.fn().mockResolvedValue(undefined);
    const recent = vi.fn().mockResolvedValue(undefined);
    watcher.onFullCandles(full);
    watcher.onCandles(recent);
    write('candles_EURUSD_M15.json', candles);
    await poll(watcher);
    expect(recent).toHaveBeenCalledTimes(1);
    expect(full).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(dir, 'candles_EURUSD_M15.json'))).toBe(true);
  });
});
