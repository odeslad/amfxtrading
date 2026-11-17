import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { requireAuth } from '../middleware/requireAuth';
import statusRouter from './status';
import { register, setPipeState } from '../store/liveness';
import { resetSystemStatus, sampleSystemStatus, setHiddenBrokers } from '../store/system-status';

// The real config needs the server environment (database, brokers file); the route only needs the
// secret. vi.mock is hoisted above the imports, so the session check already gets this one.
const JWT_SECRET = 'spec045-test-secret';
vi.mock('../config', () => ({ config: { jwtSecret: 'spec045-test-secret' } }));

// Mounted as in app.ts: cookies parsed, then the session check, then the router.
const server = http.createServer(express().use(cookieParser()).use('/status', requireAuth, statusRouter));
let url = '';

beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/status`;
});

afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
});

const session = (): string => `token=${jwt.sign({ sub: 1 }, JWT_SECRET)}`;

describe('GET /status', () => {
  it('answers 401 without a session cookie', async () => {
    const res = await fetch(url);
    expect(res.status).toBe(401);
  });

  it('returns the system status, without the hidden brokers', async () => {
    resetSystemStatus();
    register('spec045-live', { pipe: true, watcher: false });
    register('spec045-hidden', { pipe: true, watcher: false });
    setPipeState('spec045-live', 'connected');
    setHiddenBrokers(['spec045-hidden']);

    const res = await fetch(url, { headers: { cookie: session() } });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['at', 'brokers', 'level', 'server']);
    expect(body.server).toEqual({
      cpuPct: null, freeMemMb: expect.any(Number), totalMemMb: expect.any(Number),
    });
    const brokers = body.brokers as { name: string }[];
    expect(brokers.find(b => b.name === 'spec045-live')).toEqual({ name: 'spec045-live', state: 'connected', level: 'ok', tickDelayS: null });
    expect(brokers.some(b => b.name === 'spec045-hidden')).toBe(false);
  });

  it('serves the last sample taken, with a CPU figure from the second one on', async () => {
    const sampled = sampleSystemStatus();
    const body = await (await fetch(url, { headers: { cookie: session() } })).json() as { at: string; server: { cpuPct: number | null } };
    expect(body.at).toBe(sampled.at);
    expect(body.server.cpuPct === null || (body.server.cpuPct >= 0 && body.server.cpuPct <= 100)).toBe(true);
  });
});
