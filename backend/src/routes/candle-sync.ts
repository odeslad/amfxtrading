import { Router } from 'express';
import { randomUUID } from 'crypto';
import { config } from '../config';
import { db } from '../db/client';
import { asyncRoute } from '../middleware/asyncRoute';
import { BadRequest, Conflict, NotFound } from '../middleware/errors';
import { bodyRecord, integer, nonEmptyString, oneOf } from '../middleware/parse';
import { pipeStateOf } from '../store/liveness';
import { writeSyncCommand } from '../bridge/sync-io';
import { getBid } from '../store/ticks';

export const SYNC_TIMEFRAMES = ['M5', 'M15', 'H1', 'H4', 'D1'] as const;
export type SyncTimeframe = (typeof SYNC_TIMEFRAMES)[number];

export const TARGET_MIN = 100;
export const TARGET_MAX = 50_000;
export const TARGET_DEFAULT = 10_000;

const BUSY_STATES: ReadonlySet<string> = new Set(['queued', 'running']);

export interface TargetsInput {
  broker: string;
  targets: Partial<Record<SyncTimeframe, number>>;
}

export interface SyncRequestInput {
  broker: string;
  timeframes: SyncTimeframe[];
}

export function parseTargets(raw: unknown): TargetsInput {
  const body = bodyRecord(raw);
  const broker = nonEmptyString(body.broker, 'broker');
  const rawTargets = bodyRecord(body.targets);
  const targets: Partial<Record<SyncTimeframe, number>> = {};
  for (const [tf, value] of Object.entries(rawTargets)) {
    const timeframe = oneOf(tf, 'timeframe', SYNC_TIMEFRAMES);
    const target = integer(value, `targets.${timeframe}`, { min: TARGET_MIN });
    if (target > TARGET_MAX) throw new BadRequest(`targets.${timeframe} must be at most ${TARGET_MAX}`);
    targets[timeframe] = target;
  }
  if (Object.keys(targets).length === 0) throw new BadRequest('targets must name at least one timeframe');
  return { broker, targets };
}

export function parseSyncRequest(raw: unknown): SyncRequestInput {
  const body = bodyRecord(raw);
  const broker = nonEmptyString(body.broker, 'broker');
  if (!Array.isArray(body.timeframes) || body.timeframes.length === 0) {
    throw new BadRequest('timeframes must be a non-empty array');
  }
  const picked = new Set(body.timeframes.map((tf: unknown) => oneOf(tf, 'timeframes', SYNC_TIMEFRAMES)));
  return { broker, timeframes: SYNC_TIMEFRAMES.filter((tf) => picked.has(tf)) };
}

function bridgePathOf(broker: string): string {
  const found = config.brokers.find((b) => b.name === broker);
  if (!found) throw new NotFound(`Unknown broker: ${broker}`);
  return found.bridgePath;
}

async function ensureRows(): Promise<void> {
  await db.candleSync.createMany({
    data: config.brokers.flatMap((b) =>
      SYNC_TIMEFRAMES.map((timeframe) => ({ broker: b.name, timeframe, target: TARGET_DEFAULT })),
    ),
    skipDuplicates: true,
  });
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export interface SymbolSyncTiming {
  tickWaitMs: number;
  busyWaitMs: number;
  pollMs: number;
}

const SYMBOL_SYNC_TIMING: SymbolSyncTiming = { tickWaitMs: 120_000, busyWaitMs: 30 * 60_000, pollMs: 5_000 };

type SyncBroadcaster = (broker: string, update: Record<string, unknown>) => void;
let broadcastSync: SyncBroadcaster | null = null;
export const setCandleSyncBroadcaster = (fn: SyncBroadcaster): void => { broadcastSync = fn; };

// Every row of the broker to one state, announced over the `candle_sync` WS message like the watcher does.
async function markRows(broker: string, where: { requestId?: string }, state: string, detail: string, requestId?: string | null): Promise<void> {
  await db.candleSync.updateMany({ where: { broker, ...where }, data: { state, detail, ...(requestId !== undefined ? { requestId } : {}) } });
  const rows = await db.candleSync.findMany({ where: { broker } });
  for (const r of rows) {
    broadcastSync?.(broker, { timeframe: r.timeframe, state: r.state, detail: r.detail, candleCount: r.candleCount, lastSyncAt: r.lastSyncAt?.toISOString() ?? null });
  }
}

// Spec 056: pairs just turned on get their history on every timeframe. Settings › Data shows each step:
// waiting for the EA to stream them, waiting for a sync in progress, the sync itself (watcher), or why it stopped.
export async function syncNewSymbols(broker: string, symbols: string[], timing: SymbolSyncTiming = SYMBOL_SYNC_TIMING): Promise<'queued' | 'no-ticks' | 'busy' | 'disconnected'> {
  const bridgePath = bridgePathOf(broker);
  const label = symbols.join(', ');
  const marker = `pending:${randomUUID()}`;
  const isBusy = (r: { state: string; requestId: string | null }) => BUSY_STATES.has(r.state) && r.requestId !== marker;
  await ensureRows();

  // Shown only when no sync of the broker is running, so a sync in progress keeps its own rows.
  let rows = await db.candleSync.findMany({ where: { broker } });
  if (!rows.some(isBusy)) await markRows(broker, {}, 'queued', `${label} · waiting for the EA to stream it`, marker);

  const tickDeadline = Date.now() + timing.tickWaitMs;
  while (symbols.some((s) => getBid(broker, s) === null)) {
    if (Date.now() > tickDeadline) {
      await markRows(broker, { requestId: marker }, 'error', `${label}: the EA sent no ticks in ${Math.round(timing.tickWaitMs / 1000)} s`);
      return 'no-ticks';
    }
    await sleep(timing.pollMs);
  }

  const busyDeadline = Date.now() + timing.busyWaitMs;
  rows = await db.candleSync.findMany({ where: { broker } });
  while (rows.some(isBusy)) {
    if (Date.now() > busyDeadline) return 'busy';
    await sleep(timing.pollMs);
    rows = await db.candleSync.findMany({ where: { broker } });
  }
  if (pipeStateOf(broker) !== 'connected') {
    await markRows(broker, { requestId: marker }, 'error', `${label}: the EA of ${broker} is not connected`);
    return 'disconnected';
  }

  const id = randomUUID();
  const targetOf = (tf: string): number => rows.find((r) => r.timeframe === tf)?.target ?? TARGET_DEFAULT;
  await markRows(broker, {}, 'queued', `${label} · history requested`, id);
  writeSyncCommand(bridgePath, { id, timeframes: SYNC_TIMEFRAMES.map((tf) => ({ tf, target: targetOf(tf) })), symbols });
  return 'queued';
}

const router = Router();

router.get('/', asyncRoute(async (_req, res) => {
  await ensureRows();
  const rows = await db.candleSync.findMany({
    where: { broker: { in: config.brokers.map((b) => b.name) } },
  });
  const order = (tf: string): number => SYNC_TIMEFRAMES.indexOf(tf as SyncTimeframe);
  res.json(config.brokers.map((b) => ({
    broker: b.name,
    connected: pipeStateOf(b.name) === 'connected',
    timeframes: rows
      .filter((r) => r.broker === b.name)
      .sort((x, y) => order(x.timeframe) - order(y.timeframe))
      .map((r) => ({
        timeframe: r.timeframe,
        target: r.target,
        candleCount: r.candleCount,
        lastSyncAt: r.lastSyncAt,
        state: r.state,
        detail: r.detail,
      })),
  })));
}));

router.put('/targets', asyncRoute(async (req, res) => {
  const { broker, targets } = parseTargets(req.body);
  bridgePathOf(broker);
  await ensureRows();
  for (const [timeframe, target] of Object.entries(targets)) {
    await db.candleSync.update({ where: { broker_timeframe: { broker, timeframe } }, data: { target } });
  }
  res.json({ ok: true });
}));

router.post('/', asyncRoute(async (req, res) => {
  const { broker, timeframes } = parseSyncRequest(req.body);
  const bridgePath = bridgePathOf(broker);
  if (pipeStateOf(broker) !== 'connected') {
    res.status(503).json({ error: `The EA of ${broker} is not connected` });
    return;
  }
  await ensureRows();

  const rows = await db.candleSync.findMany({ where: { broker } });
  if (rows.some((r) => BUSY_STATES.has(r.state))) throw new Conflict(`A sync of ${broker} is already in progress`);

  const id = randomUUID();
  const targetOf = (tf: string): number => rows.find((r) => r.timeframe === tf)?.target ?? TARGET_DEFAULT;
  await db.candleSync.updateMany({
    where: { broker, timeframe: { in: timeframes } },
    data: { state: 'queued', detail: null, requestId: id },
  });
  writeSyncCommand(bridgePath, { id, timeframes: timeframes.map((tf) => ({ tf, target: targetOf(tf) })) });
  res.status(202).json({ status: 'queued', id });
}));

export default router;
