import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

const { db, cfg, monitorRef, live } = vi.hoisted(() => ({
  db: { serverSample: { findMany: vi.fn() }, $queryRaw: vi.fn() },
  cfg: { jwtSecret: 'test-secret', brokers: [{ name: 'demo', bridgePath: 'x' }, { name: 'FTMO', bridgePath: 'y' }] },
  monitorRef: { current: null as null | { snapshot: () => unknown } },
  live: { map: new Map<string, unknown>() },
}));
vi.mock('../db/client', () => ({ db }));
vi.mock('../config', () => ({ config: cfg }));
vi.mock('../services/server-monitor', () => ({ serverMonitor: () => monitorRef.current }));
vi.mock('../store/liveness', () => ({ snapshot: () => live.map }));

import router, { lastBootAfterCrash, parseRange, type serverReport } from './server';

type Report = ReturnType<typeof serverReport>;
import { requireAuth } from '../middleware/requireAuth';
import { BadRequest, errorHandler } from '../middleware/errors';

const NOW = Date.now();
const snapshot = {
  cores: 8, memTotalMb: 16384, memUsedMb: 3100, cpu: 13.2,
  fastAt: new Date(NOW - 5_000), probeAt: new Date(NOW - 30_000), backendRestarts: 1,
  probe: {
    host: 'WIN-XL', os: 'Windows Server 2025', bootAt: new Date(NOW - 3_600_000).toISOString(),
    pageFileMb: 900, diskFreeGb: 448.9, diskTotalGb: 479.4,
    services: [{ name: 'nginx', state: 'running' }],
    terminals: [{ broker: 'demo', running: true, memMb: 30 }, { broker: 'FTMO', running: false, memMb: null }],
  },
  events: [{ at: new Date(NOW - 3_590_000).toISOString(), kind: 'bugcheck', code: '0x1A', param1: '0x3F' }],
};

let server: http.Server;
let base = '';
const cookie = `token=${jwt.sign({ sub: 1 }, cfg.jwtSecret)}`;
const get = (p: string, auth = true) => fetch(base + p, { headers: auth ? { cookie } : {} });

beforeAll(async () => {
  const app = express();
  app.use(cookieParser());
  app.use('/server', requireAuth, router);
  app.use(errorHandler);
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/server`;
});

afterAll(() => { server.close(); });

beforeEach(() => {
  vi.clearAllMocks();
  monitorRef.current = { snapshot: () => snapshot };
  live.map = new Map([
    ['demo', { pipe: 'connected', lastTickAt: new Date(NOW - 1_000), lastSyncAt: null, watcher: true }],
    ['FTMO', { pipe: 'listening', lastTickAt: new Date(NOW - 360_000), lastSyncAt: null, watcher: true }],
  ]);
});

describe('parseRange and lastBootAfterCrash', () => {
  it('accepts 24h and 7d, defaults to 24h and rejects the rest', () => {
    expect(parseRange(undefined)).toBe('24h');
    expect(parseRange('7d')).toBe('7d');
    expect(() => parseRange('30d')).toThrow(BadRequest);
  });

  it('marks a boot followed within minutes by an unclean-stop event', () => {
    const boot = '2026-11-19T10:31:59Z';
    expect(lastBootAfterCrash(boot, [{ at: '2026-11-19T10:32:10Z', kind: 'bugcheck', code: '0x1A', param1: '0x3F' }])).toBe(true);
    expect(lastBootAfterCrash(boot, [{ at: '2026-11-12T08:02:00Z', kind: 'unexpected', code: null, param1: null }])).toBe(false);
    expect(lastBootAfterCrash(boot, null)).toBe(false);
  });
});

describe('GET /server', () => {
  it('needs a session', async () => {
    expect((await get('', false)).status).toBe(401);
    expect((await get('/history', false)).status).toBe(401);
  });

  it('answers 503 when the monitor is off', async () => {
    monitorRef.current = null;
    expect((await get('')).status).toBe(503);
  });

  it('joins the snapshot with every broker of brokers.json, its terminal and its pipe', async () => {
    const res = await get('');
    expect(res.status).toBe(200);
    const body = await res.json() as Report;
    expect(body).toMatchObject({
      host: 'WIN-XL', cores: 8, memTotalMb: 16384, memUsedMb: 3100, cpu: 13.2, pageFileMb: 900,
      diskFreeGb: 448.9, lastBootAfterCrash: true, backend: { restarts: 1 },
      services: [{ name: 'nginx', state: 'running' }],
    });
    expect(body.staleS).toBeGreaterThanOrEqual(30);
    expect(body.uptimeS).toBeGreaterThanOrEqual(3600);
    expect(body.terminals).toEqual([
      { broker: 'demo', running: true, memMb: 30, pipe: 'connected', tickAgeS: expect.any(Number) },
      { broker: 'FTMO', running: false, memMb: null, pipe: 'listening', tickAgeS: expect.any(Number) },
    ]);
    expect(body.terminals[0].tickAgeS).toBeLessThan(10);
    expect(body.terminals[1].tickAgeS).toBeGreaterThanOrEqual(360);
    expect(body.events).toHaveLength(1);
  });

  it('answers before the first probe with what Node knows', async () => {
    monitorRef.current = { snapshot: () => ({ ...snapshot, probe: null, probeAt: null, events: null }) };
    const body = await (await get('')).json() as Report;
    expect(body).toMatchObject({ host: null, bootAt: null, uptimeS: null, lastBootAfterCrash: false, cpu: 13.2, staleS: null });
    expect(body.terminals[0]).toMatchObject({ broker: 'demo', running: null, pipe: 'connected' });
  });
});

describe('GET /server/history', () => {
  it('returns the minute rows of the last 24 hours by default', async () => {
    db.serverSample.findMany.mockResolvedValue([{ time: new Date('2026-11-19T12:00:00Z'), cpu: 12.5, memUsedMb: 3000, pageFileMb: null }]);
    const res = await get('/history');
    expect(await res.json()).toEqual([{ t: '2026-11-19T12:00:00.000Z', cpu: 12.5, memUsedMb: 3000, pageFileMb: null }]);
    const where = db.serverSample.findMany.mock.calls[0][0].where.time.gte as Date;
    expect(Math.abs(Date.now() - 24 * 3_600_000 - where.getTime())).toBeLessThan(5_000);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it('averages 7 days into 10-minute buckets in SQL', async () => {
    db.$queryRaw.mockResolvedValue([{ t: new Date('2026-11-19T12:00:00Z'), cpu: 11.1, memUsedMb: 3050, pageFileMb: 880 }]);
    const res = await get('/history?range=7d');
    expect(await res.json()).toEqual([{ t: '2026-11-19T12:00:00.000Z', cpu: 11.1, memUsedMb: 3050, pageFileMb: 880 }]);
    const sql = (db.$queryRaw.mock.calls[0][0] as TemplateStringsArray).join('?');
    expect(sql).toContain("date_bin('10 minutes'");
    expect(sql).toContain('GROUP BY 1');
  });

  it('rejects another range', async () => {
    expect((await get('/history?range=30d')).status).toBe(400);
  });
});
