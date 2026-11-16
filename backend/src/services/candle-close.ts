import { db } from '../db/client';
import type { TickBatch, TickData } from '../bridge/pipe-reader';

// A closed candle rebuilt from the last tick of the previous bar (spec 025): the EA's
// candle file only reaches the DB a poll later, this one lands at the rollover.
export interface ClosedCandle {
  symbol: string;
  timeframe: string;
  time: number;   // ms, broker-time base shared with candles.time
  open: number;
  high: number;
  low: number;
  close: number;  // last bid before the rollover
}

interface Snapshot {
  time: number;
  open: number;
  high: number;
  low: number;
  bid: number;
  serverNow: number;  // broker server time of the tick, same base as `time`
}

const MINUTE_MS = 60_000;

const TF_FIELDS = [
  { tf: 'M5', periodMs: 5 * MINUTE_MS, time: 'm5_time', open: 'm5_open', high: 'm5_high', low: 'm5_low' },
  { tf: 'M15', periodMs: 15 * MINUTE_MS, time: 'm15_time', open: 'm15_open', high: 'm15_high', low: 'm15_low' },
  { tf: 'H1', periodMs: 60 * MINUTE_MS, time: 'h1_time', open: 'h1_open', high: 'h1_high', low: 'h1_low' },
  { tf: 'H4', periodMs: 240 * MINUTE_MS, time: 'h4_time', open: 'h4_open', high: 'h4_high', low: 'h4_low' },
  { tf: 'D1', periodMs: 1440 * MINUTE_MS, time: 'd1_time', open: 'd1_open', high: 'd1_high', low: 'd1_low' },
] as const satisfies ReadonlyArray<{ tf: string; periodMs: number; time: keyof TickData; open: keyof TickData; high: keyof TickData; low: keyof TickData }>;

// The bar may outlive its period while its symbol has no quote; past this many
// periods it is stale history, not the bar in progress.
const LIVE_BAR_PERIODS = 2;
const PRICE_EPSILON = 1e-9;

// A terminal that starts with stale history reports an old bar next to today's bid:
// that bar must not be stored as a closed candle (spec 044).
function wasInProgress(snapshot: Snapshot, periodMs: number): boolean {
  const insideBar = snapshot.serverNow >= snapshot.time && snapshot.serverNow < snapshot.time + LIVE_BAR_PERIODS * periodMs;
  const bidInsideRange = snapshot.bid >= snapshot.low - PRICE_EPSILON && snapshot.bid <= snapshot.high + PRICE_EPSILON;
  return insideBar && bidInsideRange;
}

export type CandleCloseState = Map<string, Snapshot>;

export const createCandleCloseState = (): CandleCloseState => new Map();

// Pure: feeds a batch into the state and returns the candles that closed in it.
// The first tick of a key only seeds the snapshot; a candle needs a previous bar that was in progress.
export function trackCandleCloses(state: CandleCloseState, broker: string, batch: TickBatch): ClosedCandle[] {
  const closed: ClosedCandle[] = [];
  for (const tick of batch) {
    for (const f of TF_FIELDS) {
      const time = tick[f.time];
      if (!Number.isFinite(time)) continue;
      const key = `${broker}:${tick.symbol}:${f.tf}`;
      const prev = state.get(key);
      if (prev && prev.time !== time && wasInProgress(prev, f.periodMs)) {
        closed.push({ symbol: tick.symbol, timeframe: f.tf, time: prev.time, open: prev.open, high: prev.high, low: prev.low, close: prev.bid });
      }
      const serverNow = tick.time + (tick.broker_offset ?? 0) * 1000;
      state.set(key, { time, open: tick[f.open], high: tick[f.high], low: tick[f.low], bid: tick.bid, serverNow });
    }
  }
  return closed;
}

// Stores the candle unless the EA already wrote that row (the file keeps authority).
export async function persistClosedCandle(broker: string, c: ClosedCandle): Promise<void> {
  const time = new Date(c.time);
  await db.candle.upsert({
    where: { broker_symbol_timeframe_time: { broker, symbol: c.symbol, timeframe: c.timeframe, time } },
    update: {},
    create: { broker, symbol: c.symbol, timeframe: c.timeframe, time, open: c.open, high: c.high, low: c.low, close: c.close },
  });
}
