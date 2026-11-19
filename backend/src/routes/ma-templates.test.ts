import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

const { db, cfg } = vi.hoisted(() => ({
  db: {
    maTemplate: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
    maTemplateBroker: { findMany: vi.fn(), deleteMany: vi.fn(), upsert: vi.fn() },
    $transaction: vi.fn(),
  },
  cfg: { jwtSecret: 'test-secret' },
}));
vi.mock('../db/client', () => ({ db }));
vi.mock('../config', () => ({ config: cfg }));

import router, { parseAverages, parseName, setMaTemplatesBroadcaster } from './ma-templates';
import { requireAuth } from '../middleware/requireAuth';
import { BadRequest, errorHandler } from '../middleware/errors';

const USER = 7;
const ma = (extra: Record<string, unknown> = {}) => ({ id: 'a1', type: 'sma', period: 50, color: '#4caf84', style: 'dashed', width: 1, ...extra });
const tpl = (id: number, isDefault = false, extra: Record<string, unknown> = {}) =>
  ({ id, userId: USER, name: `T${id}`, isDefault, averages: [ma()], createdAt: new Date(), updatedAt: new Date(), ...extra });

let server: http.Server;
let base = '';
const cookie = `token=${jwt.sign({ sub: USER }, cfg.jwtSecret)}`;
const call = (method: string, path: string, body?: unknown, auth = true) =>
  fetch(base + path, {
    method,
    headers: { ...(auth ? { cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
const notified = vi.fn();

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/ma-templates', requireAuth, router);
  app.use(errorHandler);
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/ma-templates`;
  setMaTemplatesBroadcaster(notified);
});

afterAll(() => { server.close(); });

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockResolvedValue([]);
});

describe('validation', () => {
  it('accepts EMA and SMA with a period of 1 or more and no upper limit', () => {
    expect(parseAverages([ma({ type: 'ema', period: 1 }), ma({ id: 'a2', period: 5000 })])).toHaveLength(2);
    expect(parseAverages([])).toEqual([]);
  });

  it('rejects a bad type, period, colour, style, width or a repeated id', () => {
    expect(() => parseAverages([ma({ type: 'wma' })])).toThrow(BadRequest);
    expect(() => parseAverages([ma({ period: 0 })])).toThrow(BadRequest);
    expect(() => parseAverages([ma({ period: 2.5 })])).toThrow(BadRequest);
    expect(() => parseAverages([ma({ color: 'red' })])).toThrow(BadRequest);
    expect(() => parseAverages([ma({ style: 'wavy' })])).toThrow(BadRequest);
    expect(() => parseAverages([ma({ width: 4 })])).toThrow(BadRequest);
    expect(() => parseAverages([ma(), ma()])).toThrow(BadRequest);
    expect(() => parseAverages({})).toThrow(BadRequest);
  });

  it('trims the name and keeps it within 40 characters', () => {
    expect(parseName('  Prop firms ')).toBe('Prop firms');
    expect(() => parseName('   ')).toThrow(BadRequest);
    expect(() => parseName('x'.repeat(41))).toThrow(BadRequest);
  });
});

describe('routes', () => {
  it('needs a session', async () => {
    expect((await call('GET', '', undefined, false)).status).toBe(401);
  });

  it('lists the templates and assignments, creating the default when the user has none', async () => {
    db.maTemplate.findMany.mockResolvedValueOnce([tpl(2)]).mockResolvedValueOnce([tpl(1, true), tpl(2)]);
    db.maTemplateBroker.findMany.mockResolvedValue([
      { userId: USER, broker: 'FTMO', timeframe: '', templateId: 2 },
      { userId: USER, broker: 'FTMO', timeframe: 'H1', templateId: 1 },
    ]);
    const res = await call('GET', '');
    const body = await res.json() as { templates: { id: number; isDefault: boolean }[]; assignments: unknown[] };
    expect(db.maTemplate.create).toHaveBeenCalledWith({ data: { userId: USER, name: 'Default', isDefault: true, averages: [] } });
    expect(body.templates.map((t) => [t.id, t.isDefault])).toEqual([[1, true], [2, false]]);
    expect(body.assignments).toEqual([
      { broker: 'FTMO', timeframe: null, templateId: 2 },
      { broker: 'FTMO', timeframe: 'H1', templateId: 1 },
    ]);
    expect(db.maTemplate.findMany).toHaveBeenCalledWith({ where: { userId: USER }, orderBy: { id: 'asc' } });
  });

  it('creates a template for the user and notifies their clients', async () => {
    db.maTemplate.create.mockResolvedValue(tpl(3, false, { name: 'Scalping' }));
    const res = await call('POST', '', { name: 'Scalping', averages: [ma()] });
    expect(res.status).toBe(201);
    expect(db.maTemplate.create).toHaveBeenCalledWith({ data: { userId: USER, name: 'Scalping', averages: [ma()] } });
    expect(notified).toHaveBeenCalledWith(USER);
  });

  it('updates only a template of the user', async () => {
    db.maTemplate.findFirst.mockResolvedValueOnce(null);
    expect((await call('PUT', '/9', { name: 'X' })).status).toBe(404);
    expect(db.maTemplate.findFirst).toHaveBeenCalledWith({ where: { id: 9, userId: USER } });
    db.maTemplate.findFirst.mockResolvedValueOnce(tpl(2));
    db.maTemplate.update.mockResolvedValue(tpl(2, false, { name: 'Renamed' }));
    expect((await call('PUT', '/2', { name: 'Renamed' })).status).toBe(200);
    expect(db.maTemplate.update).toHaveBeenCalledWith({ where: { id: 2 }, data: { name: 'Renamed' } });
    db.maTemplate.findFirst.mockResolvedValueOnce(tpl(2));
    expect((await call('PUT', '/2', {})).status).toBe(400);
  });

  it('moves the default in one transaction', async () => {
    db.maTemplate.findFirst.mockResolvedValue(tpl(2));
    expect((await call('PUT', '/2/default')).status).toBe(200);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.maTemplate.updateMany).toHaveBeenCalledWith({ where: { userId: USER, isDefault: true }, data: { isDefault: false } });
    expect(db.maTemplate.update).toHaveBeenCalledWith({ where: { id: 2 }, data: { isDefault: true } });
  });

  it('refuses to delete the default and deletes another (its brokers cascade to the default)', async () => {
    db.maTemplate.findFirst.mockResolvedValueOnce(tpl(1, true));
    expect((await call('DELETE', '/1')).status).toBe(409);
    expect(db.maTemplate.delete).not.toHaveBeenCalled();
    db.maTemplate.findFirst.mockResolvedValueOnce(tpl(2));
    expect((await call('DELETE', '/2')).status).toBe(204);
    expect(db.maTemplate.delete).toHaveBeenCalledWith({ where: { id: 2 } });
    expect(notified).toHaveBeenCalledTimes(1);
  });

  it('assigns a template to a broker for every timeframe and clears it back to the default', async () => {
    db.maTemplate.findFirst.mockResolvedValue(tpl(2));
    expect((await call('PUT', '/assignments', { broker: 'FTMO', templateId: 2 })).status).toBe(200);
    expect(db.maTemplateBroker.upsert).toHaveBeenCalledWith({
      where: { userId_broker_timeframe: { userId: USER, broker: 'FTMO', timeframe: '' } },
      create: { userId: USER, broker: 'FTMO', timeframe: '', templateId: 2 },
      update: { templateId: 2 },
    });
    expect((await call('PUT', '/assignments', { broker: 'FTMO', timeframe: null, templateId: null })).status).toBe(200);
    expect(db.maTemplateBroker.deleteMany).toHaveBeenCalledWith({ where: { userId: USER, broker: 'FTMO', timeframe: '' } });
    db.maTemplate.findFirst.mockResolvedValueOnce(null);
    expect((await call('PUT', '/assignments', { broker: 'FTMO', templateId: 99 })).status).toBe(404);
  });

  it('assigns and clears a template on one timeframe of a broker', async () => {
    db.maTemplate.findFirst.mockResolvedValue(tpl(2));
    const res = await call('PUT', '/assignments', { broker: 'FTMO', timeframe: 'H1', templateId: 2 });
    expect(await res.json()).toEqual({ broker: 'FTMO', timeframe: 'H1', templateId: 2 });
    expect(db.maTemplateBroker.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_broker_timeframe: { userId: USER, broker: 'FTMO', timeframe: 'H1' } },
    }));
    await call('PUT', '/assignments', { broker: 'FTMO', timeframe: 'H1', templateId: null });
    expect(db.maTemplateBroker.deleteMany).toHaveBeenCalledWith({ where: { userId: USER, broker: 'FTMO', timeframe: 'H1' } });
    expect((await call('PUT', '/assignments', { broker: 'FTMO', timeframe: 'H2', templateId: 2 })).status).toBe(400);
  });
});
