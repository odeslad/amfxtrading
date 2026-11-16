import { db } from '../db/client';
import type { BridgeCandles } from '../bridge/file-watcher';
import { chunks } from './chunk';

type BridgeCandle = BridgeCandles['candles'][number];

export interface CandleColumns {
  times: number[];
  opens: number[];
  highs: number[];
  lows: number[];
  closes: number[];
}

// The last bar is still forming; only closed bars are stored. A time repeated in
// the file keeps its last values: one statement cannot touch the same row twice.
export function closedBars(candles: BridgeCandle[]): BridgeCandle[] {
  const byTime = new Map<number, BridgeCandle>();
  for (const c of candles.slice(0, -1)) byTime.set(c.time, c);
  return [...byTime.values()];
}

export function toColumns(candles: BridgeCandle[]): CandleColumns {
  return {
    times: candles.map((c) => c.time),
    opens: candles.map((c) => c.open),
    highs: candles.map((c) => c.high),
    lows: candles.map((c) => c.low),
    closes: candles.map((c) => c.close),
  };
}

// The EA's file has authority over every closed bar (spec 044): a stored candle
// whose values differ takes the file's, one that already matches is not rewritten.
export async function upsertCandles(
  broker: string,
  symbol: string,
  timeframe: string,
  data: BridgeCandles,
): Promise<number> {
  let written = 0;
  for (const batch of chunks(closedBars(data.candles))) {
    const { times, opens, highs, lows, closes } = toColumns(batch);
    written += await db.$executeRaw`
      INSERT INTO "candles" ("broker", "symbol", "timeframe", "time", "open", "high", "low", "close")
      SELECT ${broker}, ${symbol}, ${timeframe}, to_timestamp(bar."time") AT TIME ZONE 'UTC', bar."open", bar."high", bar."low", bar."close"
      FROM unnest(
        ${times}::double precision[],
        ${opens}::double precision[],
        ${highs}::double precision[],
        ${lows}::double precision[],
        ${closes}::double precision[]
      ) AS bar("time", "open", "high", "low", "close")
      ON CONFLICT ("broker", "symbol", "timeframe", "time") DO UPDATE
        SET "open" = EXCLUDED."open", "high" = EXCLUDED."high", "low" = EXCLUDED."low", "close" = EXCLUDED."close"
        WHERE ("candles"."open", "candles"."high", "candles"."low", "candles"."close")
          IS DISTINCT FROM (EXCLUDED."open", EXCLUDED."high", EXCLUDED."low", EXCLUDED."close")
    `;
  }
  return written;
}
