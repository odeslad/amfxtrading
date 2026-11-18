import { describe, it, expect, vi, beforeEach } from 'vitest';

const { db } = vi.hoisted(() => ({
  db: {
    candle: { groupBy: vi.fn() },
    candleLegacy: { groupBy: vi.fn() },
    candleSync: { findMany: vi.fn() },
  },
}));
vi.mock('../db/client', () => ({ db }));

import { candleTable, isMigrated, loadMigratedPairs, markMigrated, storedSymbols } from './candle-store';

describe('candle-store', () => {
  beforeEach(async () => {
    db.candleSync.findMany.mockResolvedValue([]);
    await loadMigratedPairs();
  });

  it('sends a pair that was never synced to the legacy table', () => {
    expect(isMigrated('demo', 'M5')).toBe(false);
    expect(candleTable('demo', 'M5')).toBe(db.candleLegacy);
  });

  it('sends a pair to the new table once it is marked migrated, and only that pair', () => {
    markMigrated('demo', 'M5');
    expect(candleTable('demo', 'M5')).toBe(db.candle);
    expect(candleTable('demo', 'H1')).toBe(db.candleLegacy);
    expect(candleTable('ftmo', 'M5')).toBe(db.candleLegacy);
  });

  it('loads the migrated pairs from the synced rows at start', async () => {
    db.candleSync.findMany.mockResolvedValue([{ broker: 'ftmo', timeframe: 'D1' }]);
    await loadMigratedPairs();
    expect(db.candleSync.findMany).toHaveBeenLastCalledWith({
      where: { lastSyncAt: { not: null } },
      select: { broker: true, timeframe: true },
    });
    expect(candleTable('ftmo', 'D1')).toBe(db.candle);
  });

  it('forgets pairs that are no longer migrated when it reloads', async () => {
    markMigrated('demo', 'M5');
    await loadMigratedPairs();
    expect(isMigrated('demo', 'M5')).toBe(false);
  });

  it('lists the symbols of both tables once each, sorted', async () => {
    db.candle.groupBy.mockResolvedValue([{ symbol: 'GBPUSD' }, { symbol: 'EURUSD' }]);
    db.candleLegacy.groupBy.mockResolvedValue([{ symbol: 'EURUSD' }, { symbol: 'AUDUSD' }]);
    expect(await storedSymbols('demo')).toEqual(['AUDUSD', 'EURUSD', 'GBPUSD']);
    expect(db.candle.groupBy).toHaveBeenLastCalledWith({ by: ['symbol'], where: { broker: 'demo' } });
    expect(db.candleLegacy.groupBy).toHaveBeenLastCalledWith({ by: ['symbol'], where: { broker: 'demo' } });
  });
});
