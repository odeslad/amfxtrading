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
// a terminal that has not loaded its history yet must not wipe what is stored.
export const MIN_BARS_TO_TRIM = 500;

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
  trimmed: number;
}

// A full history is the whole of what MT4 holds without holes (spec 044). Its bars are
// stored; when the EA had to cut it at a hole, whatever is stored from before its first
// bar lies behind that hole and is dropped. Without a cut the older stored bars connect
// to it and stay: the table keeps more history than the terminal's own bar limit.
export async function replaceCandleHistory(
  broker: string,
  symbol: string,
  timeframe: string,
  data: BridgeCandles,
): Promise<HistoryReplaced> {
  const bars = closedBars(data.candles);
  const written = await writeBars(broker, symbol, timeframe, bars);
  const start = data.cutAtHole === true ? historyStart(bars) : null;
  if (start === null) return { written, trimmed: 0 };
  const trimmed = await db.$executeRaw`
    DELETE FROM "candles"
    WHERE "broker" = ${broker} AND "symbol" = ${symbol} AND "timeframe" = ${timeframe}
      AND "time" < to_timestamp(${start}::double precision) AT TIME ZONE 'UTC'
  `;
  return { written, trimmed };
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
