import { db } from '../db/client';

// Spec 064: the closed part of each broker's Day P&L (profit + swap + commission of the trades
// closed since the broker's midnight). It changes only when a trade closes, so it is computed
// once per change and sent with every account message instead of being polled.

type Aggregate = (broker: string, from: Date) => Promise<number>;

interface Entry {
  dayStart: number;
  value: number | null;
}

// The EA sends TimeCurrent() − TimeGMT(), and TimeCurrent() is the time of the last quote, so
// the offset drifts by a few seconds from tick to tick. Real broker offsets are whole quarters
// of an hour: rounding keeps the broker day stable instead of recomputing on every drift.
const OFFSET_STEP_SEC = 15 * 60;
const roundOffset = (sec: number): number => Math.round(sec / OFFSET_STEP_SEC) * OFFSET_STEP_SEC;

// Start of today in broker time, as a UTC instant.
export function brokerDayStart(nowMs: number, brokerOffsetSec: number): number {
  const offset = roundOffset(brokerOffsetSec);
  const brokerNow = new Date(nowMs + offset * 1000);
  brokerNow.setUTCHours(0, 0, 0, 0);
  return brokerNow.getTime() - offset * 1000;
}

export function createClosedToday(aggregate: Aggregate, now: () => number = Date.now, log: (line: string) => void = console.log) {
  const cache = new Map<string, Entry>();
  const running = new Set<string>();
  const again = new Map<string, number>();

  // One aggregate at a time per broker; a request meanwhile runs once more afterwards.
  const refresh = async (broker: string, brokerOffsetSec: number): Promise<void> => {
    if (running.has(broker)) { again.set(broker, brokerOffsetSec); return; }
    running.add(broker);
    try {
      const dayStart = brokerDayStart(now(), brokerOffsetSec);
      const value = await aggregate(broker, new Date(dayStart));
      cache.set(broker, { dayStart, value });
      log(`[DAYPNL] ${broker} recomputed`);
    } catch (err) {
      log(`[DAYPNL] ${broker} failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      running.delete(broker);
      const offset = again.get(broker);
      if (offset !== undefined) {
        again.delete(broker);
        void refresh(broker, offset);
      }
    }
  };

  // The value for the broker's current day, or null while it is being computed (first use,
  // a new day or a new offset).
  const get = (broker: string, brokerOffsetSec: number): number | null => {
    const dayStart = brokerDayStart(now(), brokerOffsetSec);
    const entry = cache.get(broker);
    if (entry?.dayStart === dayStart) return entry.value;
    cache.set(broker, { dayStart, value: null });
    void refresh(broker, brokerOffsetSec);
    return null;
  };

  return { get, refresh };
}

const sumClosed: Aggregate = async (broker, from) => {
  const closed = await db.trade.aggregate({
    where: { broker, closeTime: { gte: from } },
    _sum: { profit: true, swap: true, commission: true },
  });
  return (closed._sum.profit ?? 0) + (closed._sum.swap ?? 0) + (closed._sum.commission ?? 0);
};

export const closedToday = createClosedToday(sumClosed);
