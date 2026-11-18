import { db } from '../db/client';

// Spec 049: a broker and timeframe reads and writes the old candles table until its first
// manual sync stores a fresh history in the new one; from then on it only uses the new one.

type CandleTable = typeof db.candle;

const migratedPairs = new Set<string>();

const pairKey = (broker: string, timeframe: string): string => `${broker}\u0000${timeframe}`;

export async function loadMigratedPairs(): Promise<void> {
  const rows = await db.candleSync.findMany({
    where: { lastSyncAt: { not: null } },
    select: { broker: true, timeframe: true },
  });
  migratedPairs.clear();
  for (const r of rows) migratedPairs.add(pairKey(r.broker, r.timeframe));
}

export function markMigrated(broker: string, timeframe: string): void {
  migratedPairs.add(pairKey(broker, timeframe));
}

export function isMigrated(broker: string, timeframe: string): boolean {
  return migratedPairs.has(pairKey(broker, timeframe));
}

// Both models have the same columns and key, so the legacy delegate answers the same calls.
export function candleTable(broker: string, timeframe: string): CandleTable {
  return isMigrated(broker, timeframe) ? db.candle : (db.candleLegacy as unknown as CandleTable);
}

// groupBy runs DISTINCT in SQL; findMany+distinct would load every candle row into memory.
export async function storedSymbols(broker?: string): Promise<string[]> {
  const where = broker ? { broker } : {};
  const [current, legacy] = await Promise.all([
    db.candle.groupBy({ by: ['symbol'], where }),
    db.candleLegacy.groupBy({ by: ['symbol'], where }),
  ]);
  const symbols = new Set([...current, ...legacy].map((r) => r.symbol));
  return [...symbols].sort();
}
