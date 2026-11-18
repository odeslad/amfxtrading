import fs from 'fs';
import path from 'path';
import { db } from '../db/client';
import { chunks } from '../services/chunk';
import { markMigrated } from '../services/candle-store';
import { SYNC_DIR, SYNC_STATUS_FILE, withdrawSyncCommand } from './sync-io';

// Spec 049: follows the progress the EA writes to sync-status.json while it rebuilds the
// history of a broker, and swaps a timeframe into the new candles table once it is complete.

export const STALL_MS = 5 * 60_000;
const TRANSACTION_TIMEOUT_MS = 10 * 60_000;
const BUSY_STATES = ['queued', 'running'];

export interface SyncStatus {
  id: string;
  state: 'running' | 'complete' | 'finished' | 'error';
  timeframe?: string;
  symbol?: string;
  done?: number;
  total?: number;
  message?: string;
}

export interface CandleSyncUpdate {
  timeframe: string;
  state: string;
  detail: string | null;
  candleCount: number | null;
  lastSyncAt: string | null;
  done?: number;
  total?: number;
}

export type SyncBroadcast = (broker: string, update: CandleSyncUpdate) => void;

interface SyncCandleFile {
  candles: { time: number; open: number; high: number; low: number; close: number }[];
}

const STATES: ReadonlySet<string> = new Set(['running', 'complete', 'finished', 'error']);

export function parseStatus(raw: string): SyncStatus | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const s = value as Record<string, unknown>;
    if (typeof s.id !== 'string' || typeof s.state !== 'string' || !STATES.has(s.state)) return null;
    return {
      id: s.id,
      state: s.state as SyncStatus['state'],
      timeframe: typeof s.timeframe === 'string' ? s.timeframe : undefined,
      symbol: typeof s.symbol === 'string' ? s.symbol : undefined,
      done: typeof s.done === 'number' ? s.done : undefined,
      total: typeof s.total === 'number' ? s.total : undefined,
      message: typeof s.message === 'string' && s.message !== '' ? s.message : undefined,
    };
  } catch {
    return null;   // missing, or the EA is still writing it
  }
}

const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err));

export class SyncWatcher {
  private lastRaw = '';
  private busy = false;
  private timer: NodeJS.Timeout | null = null;
  // Last time the EA wrote anything: a queued timeframe waits untouched while earlier ones run.
  private lastStatusAt = 0;

  constructor(
    private readonly broker: string,
    private readonly bridgePath: string,
    private readonly broadcast: SyncBroadcast,
    private readonly now: () => number = Date.now,
  ) {}

  start(intervalMs = 1000): void {
    this.timer = setInterval(() => {
      if (this.busy) return;
      this.busy = true;
      this.poll()
        .catch((err: unknown) => console.error(`[SYNC:${this.broker}]`, errorText(err)))
        .finally(() => { this.busy = false; });
    }, intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async poll(): Promise<void> {
    const raw = this.readStatusFile();
    if (raw !== null && raw !== this.lastRaw) {
      this.lastRaw = raw;
      this.lastStatusAt = this.now();
      const status = parseStatus(raw);
      if (status) await this.handle(status);
    }
    await this.checkStall();
  }

  private readStatusFile(): string | null {
    try {
      return fs.readFileSync(path.join(this.bridgePath, SYNC_STATUS_FILE), 'utf8');
    } catch {
      return null;
    }
  }

  private async handle(status: SyncStatus): Promise<void> {
    const rows = await db.candleSync.findMany({ where: { broker: this.broker, requestId: status.id } });
    const row = rows.find((r) => r.timeframe === status.timeframe);

    // Files of a cancelled request: taken away at once so the EA does not wait for a swap that never comes.
    if (status.state === 'complete' && status.timeframe && (!row || !BUSY_STATES.includes(row.state))) {
      this.clearSyncFiles(status.timeframe);
      return;
    }
    if (rows.length === 0) return;   // a status left over from an older request

    if (status.state === 'error') {
      await this.failBusy(status.id, status.message ?? 'The EA reported an error');
      this.clearSyncFiles();
      return;
    }
    if (status.state === 'finished') {
      await this.failBusy(status.id, 'The EA finished without delivering this timeframe');
      this.clearSyncFiles();
      return;
    }

    if (!row || !BUSY_STATES.includes(row.state)) return;

    if (status.state === 'running') {
      const detail = status.symbol ? `${status.symbol} ${status.done ?? 0}/${status.total ?? 0}` : null;
      await db.candleSync.update({
        where: { broker_timeframe: { broker: this.broker, timeframe: row.timeframe } },
        data: { state: 'running', detail },
      });
      this.broadcast(this.broker, {
        timeframe: row.timeframe, state: 'running', detail,
        candleCount: row.candleCount, lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
        done: status.done, total: status.total,
      });
      return;
    }

    await this.replaceTimeframe(row.timeframe, row.candleCount, row.lastSyncAt);
  }

  // One transaction: the pair's rows in the new table are replaced by the delivered files.
  // On any failure the transaction rolls back and the previous history stays as it was.
  private async replaceTimeframe(timeframe: string, prevCount: number | null, prevSync: Date | null): Promise<void> {
    const where = { broker_timeframe: { broker: this.broker, timeframe } };
    try {
      const files = this.readTimeframeFiles(timeframe);
      if (files.length === 0) throw new Error('The EA delivered no candles');

      const rows = files.flatMap(({ symbol, candles }) => candles.map((c) => ({
        broker: this.broker, symbol, timeframe,
        time: new Date(c.time * 1000), open: c.open, high: c.high, low: c.low, close: c.close,
      })));
      const candleCount = Math.min(...files.map((f) => f.candles.length));
      const detail = `${files.length} symbols · ${rows.length} candles`;
      const lastSyncAt = new Date(this.now());

      await db.$transaction(async (tx) => {
        await tx.candle.deleteMany({ where: { broker: this.broker, timeframe } });
        for (const batch of chunks(rows)) await tx.candle.createMany({ data: batch, skipDuplicates: true });
        await tx.candleSync.update({ where, data: { state: 'done', detail, candleCount, lastSyncAt } });
      }, { timeout: TRANSACTION_TIMEOUT_MS, maxWait: 10_000 });

      markMigrated(this.broker, timeframe);
      this.broadcast(this.broker, { timeframe, state: 'done', detail, candleCount, lastSyncAt: lastSyncAt.toISOString() });
    } catch (err) {
      const detail = errorText(err);
      await db.candleSync.update({ where, data: { state: 'error', detail } });
      this.broadcast(this.broker, {
        timeframe, state: 'error', detail, candleCount: prevCount, lastSyncAt: prevSync?.toISOString() ?? null,
      });
    } finally {
      this.clearSyncFiles(timeframe);
    }
  }

  private readTimeframeFiles(timeframe: string): { symbol: string; candles: SyncCandleFile['candles'] }[] {
    const dir = path.join(this.bridgePath, SYNC_DIR);
    const suffix = `_${timeframe}.json`;
    const names = fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => n.endsWith(suffix)) : [];
    return names.map((name) => {
      const parsed = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) as SyncCandleFile;
      if (!Array.isArray(parsed.candles)) throw new Error(`${name} has no candles list`);
      return { symbol: name.slice(0, -suffix.length), candles: parsed.candles };
    });
  }

  private clearSyncFiles(timeframe?: string): void {
    const dir = path.join(this.bridgePath, SYNC_DIR);
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      if (!timeframe || name.endsWith(`_${timeframe}.json`)) fs.rmSync(path.join(dir, name), { force: true });
    }
  }

  private async failBusy(requestId: string, detail: string): Promise<void> {
    const busy = await db.candleSync.findMany({
      where: { broker: this.broker, requestId, state: { in: BUSY_STATES } },
    });
    for (const row of busy) {
      await db.candleSync.update({
        where: { broker_timeframe: { broker: this.broker, timeframe: row.timeframe } },
        data: { state: 'error', detail },
      });
      this.broadcast(this.broker, {
        timeframe: row.timeframe, state: 'error', detail,
        candleCount: row.candleCount, lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
      });
    }
  }

  // No status change for STALL_MS while a sync is queued or running: the EA is gone.
  private async checkStall(): Promise<void> {
    const busy = await db.candleSync.findMany({ where: { broker: this.broker, state: { in: BUSY_STATES } } });
    if (busy.length === 0) return;
    const lastChange = Math.max(this.lastStatusAt, ...busy.map((r) => r.updatedAt.getTime()));
    if (this.now() - lastChange < STALL_MS) return;
    withdrawSyncCommand(this.bridgePath);
    const ids = new Set(busy.map((r) => r.requestId ?? ''));
    for (const id of ids) await this.failBusy(id, 'The EA stopped answering (5 min)');
    this.clearSyncFiles();
  }
}
