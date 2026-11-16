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

// A full history shorter than this is not trusted to say where the history starts:
// a terminal that has not loaded its history yet must not wipe what is stored. Low
// enough for a real stretch after a recent hole: a few months of H4 are about 450 bars.
export const MIN_BARS_TO_TRIM = 100;

// The first bar of a full history, in seconds, or null when it is too short to trim by.
export function historyStart(bars: BridgeCandle[]): number | null {
  if (bars.length < MIN_BARS_TO_TRIM) return null;
  return bars.reduce((first, c) => Math.min(first, c.time), bars[0].time);
}

// The EA's file has authority over every closed bar (spec 044): a stored candle
// whose values differ takes the file's, one that already matches is not rewritten.
export async function upsertCandles(
  broker: string,
  symbol: string,
  timeframe: string,
  data: BridgeCandles,
): Promise<number> {
  return writeBars(broker, symbol, timeframe, closedBars(data.candles));
}

export interface HistoryReplaced {
  written: number;
  orphaned: number;
  trimmed: number;
}

// The first and last bar of a full history, in seconds, or null when it is too short to trust.
export function historyRange(bars: BridgeCandle[]): { first: number; last: number } | null {
  const first = historyStart(bars);
  if (first === null) return null;
  return { first, last: bars.reduce((last, c) => Math.max(last, c.time), bars[0].time) };
}

// A full history is the whole of what MT4 holds without holes (spec 044), and the table
// mirrors it inside its range:
// - its bars are stored;
// - a stored candle inside that range that MT4 does not hold is dropped (a bar the tick
//   rollover stored for a terminal that then replaced it with the broker's history);
// - when the EA had to cut the history at a hole, whatever is stored from before its
//   first bar lies behind that hole and is dropped too. Without a cut the older stored
//   bars connect to it and stay: the table keeps more than the terminal's own bar limit.
export async function replaceCandleHistory(
  broker: string,
  symbol: string,
  timeframe: string,
  data: BridgeCandles,
): Promise<HistoryReplaced> {
  const bars = closedBars(data.candles);
  const written = await writeBars(broker, symbol, timeframe, bars);
  const range = historyRange(bars);
  if (range === null) return { written, orphaned: 0, trimmed: 0 };

  const times = bars.map((c) => c.time);
  const orphaned = await db.$executeRaw`
    DELETE FROM "candles" AS stored
    WHERE stored."broker" = ${broker} AND stored."symbol" = ${symbol} AND stored."timeframe" = ${timeframe}
      AND stored."time" >= to_timestamp(${range.first}::double precision) AT TIME ZONE 'UTC'
      AND stored."time" <= to_timestamp(${range.last}::double precision) AT TIME ZONE 'UTC'
      AND NOT EXISTS (
        SELECT 1 FROM unnest(${times}::double precision[]) AS bar("time")
        WHERE to_timestamp(bar."time") AT TIME ZONE 'UTC' = stored."time"
      )
  `;
  if (data.cutAtHole !== true) return { written, orphaned, trimmed: 0 };

  const trimmed = await db.$executeRaw`
    DELETE FROM "candles"
    WHERE "broker" = ${broker} AND "symbol" = ${symbol} AND "timeframe" = ${timeframe}
      AND "time" < to_timestamp(${range.first}::double precision) AT TIME ZONE 'UTC'
  `;
  return { written, orphaned, trimmed };
}

async function writeBars(broker: string, symbol: string, timeframe: string, bars: BridgeCandle[]): Promise<number> {
  let written = 0;
  for (const batch of chunks(bars)) {
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
