import { candleTable } from './candle-store';
import type { BridgeCandles } from '../bridge/file-watcher';
import { chunks } from './chunk';

// The EA's file keeps authority over a candle the tick rollover stored first (spec 025):
// the newest closed bars are upserted with their values, the rest only inserted.
const AUTHORITATIVE_TAIL = 2;

export async function upsertCandles(
  broker: string,
  symbol: string,
  timeframe: string,
  data: BridgeCandles,
) {
  const table = candleTable(broker, timeframe);
  // The last bar is still forming; only closed bars are stored.
  const closed = data.candles.slice(0, -1);

  for (const batch of chunks(closed)) {
    await table.createMany({
      data: batch.map((c) => ({
        broker,
        symbol,
        timeframe,
        time: new Date(c.time * 1000),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
      skipDuplicates: true,
    });
  }

  for (const c of closed.slice(-AUTHORITATIVE_TAIL)) {
    const time = new Date(c.time * 1000);
    const values = { open: c.open, high: c.high, low: c.low, close: c.close };
    await table.upsert({
      where: { broker_symbol_timeframe_time: { broker, symbol, timeframe, time } },
      update: values,
      create: { broker, symbol, timeframe, time, ...values },
    });
  }
}
