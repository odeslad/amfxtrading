import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';

const bridge = fs.mkdtempSync(path.join(os.tmpdir(), 'candle-sync-'));

const { db, liveness, cfg } = vi.hoisted(() => ({
  db: {
    candleSync: {
      createMany: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  liveness: { pipeStateOf: vi.fn() },
  cfg: { brokers: [] as { name: string; bridgePath: string }[] },
}));
vi.mock('../db/client', () => ({ db }));
vi.mock('../store/liveness', () => liveness);
vi.mock('../config', () => ({ config: cfg }));
cfg.brokers.push({ name: 'demo', bridgePath: bridge });

import router, { parseSyncRequest, parseTargets } from './candle-sync';
import { BadRequest, errorHandler } from '../middleware/errors';

let server: http.Server;
let base = '';

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/candle-sync', router);
  app.use(errorHandler);
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/candle-sync`;
});

afterAll(() => {
  server.close();
  fs.rmSync(bridge, { recursive: true, force: true });
});

const row = (timeframe: string, state = 'idle', target = 10000) => ({
  broker: 'demo', timeframe, target, candleCount: null, lastSyncAt: null, state, detail: null, requestId: null,
});

const post = (body: unknown) =>
  fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  fs.rmSync(path.join(bridge, 'sync-command.json'), { force: true });
  liveness.pipeStateOf.mockReturnValue('connected');
  db.candleSync.findMany.mockResolvedValue([row('M5'), row('M15', 'idle', 20000), row('H1'), row('H4'), row('D1')]);
});

describe('parseTargets', () => {
  it('accepts targets between 100 and 50 000', () => {
    expect(parseTargets({ broker: 'demo', targets: { M5: 100, D1: 50000 } })).toEqual({
      broker: 'demo', targets: { M5: 100, D1: 50000 },
    });
  });

  it('rejects a target out of range, an unknown timeframe or an empty list', () => {
    expect(() => parseTargets({ broker: 'demo', targets: { M5: 99 } })).toThrow(BadRequest);
    expect(() => parseTargets({ broker: 'demo', targets: { M5: 50001 } })).toThrow(BadRequest);
    expect(() => parseTargets({ broker: 'demo', targets: { M1: 1000 } })).toThrow(BadRequest);
    expect(() => parseTargets({ broker: 'demo', targets: {} })).toThrow(BadRequest);
  });
});

describe('parseSyncRequest', () => {
  it('keeps the marked timeframes once each, in M5 → D1 order', () => {
    expect(parseSyncRequest({ broker: 'demo', timeframes: ['D1', 'M5', 'D1'] }).timeframes).toEqual(['M5', 'D1']);
  });

  it('rejects an empty list or an unknown timeframe', () => {
    expect(() => parseSyncRequest({ broker: 'demo', timeframes: [] })).toThrow(BadRequest);
    expect(() => parseSyncRequest({ broker: 'demo', timeframes: ['W1'] })).toThrow(BadRequest);
  });
});

describe('POST /candle-sync', () => {
  it('queues the marked timeframes and writes the command with their targets', async () => {
    const res = await post({ broker: 'demo', timeframes: ['M15', 'M5'] });
    expect(res.status).toBe(202);
    const { id } = (await res.json()) as { id: string };
    expect(db.candleSync.updateMany).toHaveBeenCalledWith({
      where: { broker: 'demo', timeframe: { in: ['M5', 'M15'] } },
      data: { state: 'queued', detail: null, requestId: id },
    });
    const command = JSON.parse(fs.readFileSync(path.join(bridge, 'sync-command.json'), 'utf8'));
    expect(command).toEqual({ id, timeframes: [{ tf: 'M5', target: 10000 }, { tf: 'M15', target: 20000 }] });
  });

  it('answers 409 while the broker has a sync queued or running, and writes nothing', async () => {
    db.candleSync.findMany.mockResolvedValue([row('M5', 'running'), row('H1')]);
    const res = await post({ broker: 'demo', timeframes: ['H1'] });
    expect(res.status).toBe(409);
    expect(db.candleSync.updateMany).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(bridge, 'sync-command.json'))).toBe(false);
  });

  it('answers 503 when the EA is not connected, and writes nothing', async () => {
    liveness.pipeStateOf.mockReturnValue('listening');
    const res = await post({ broker: 'demo', timeframes: ['M5'] });
    expect(res.status).toBe(503);
    expect(fs.existsSync(path.join(bridge, 'sync-command.json'))).toBe(false);
  });

  it('answers 404 for an unknown broker', async () => {
    const res = await post({ broker: 'nope', timeframes: ['M5'] });
    expect(res.status).toBe(404);
  });
});

describe('GET /candle-sync', () => {
  it('lists every timeframe of every broker in order, with its connection', async () => {
    db.candleSync.findMany.mockResolvedValue([row('D1'), row('M5'), row('H1')]);
    const res = await fetch(base);
    const body = (await res.json()) as { broker: string; connected: boolean; timeframes: { timeframe: string }[] }[];
    expect(body[0].broker).toBe('demo');
    expect(body[0].connected).toBe(true);
    expect(body[0].timeframes.map((t) => t.timeframe)).toEqual(['M5', 'H1', 'D1']);
    expect(db.candleSync.createMany).toHaveBeenCalled();
  });
});

describe('PUT /candle-sync/targets', () => {
  it('stores each target given', async () => {
    const res = await fetch(`${base}/targets`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ broker: 'demo', targets: { H4: 5000 } }),
    });
    expect(res.status).toBe(200);
    expect(db.candleSync.update).toHaveBeenCalledWith({
      where: { broker_timeframe: { broker: 'demo', timeframe: 'H4' } }, data: { target: 5000 },
    });
  });
});
