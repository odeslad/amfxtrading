import { describe, it, expect } from 'vitest';
import { createCandleCloseState, trackCandleCloses } from './candle-close';
import type { TickData } from '../bridge/pipe-reader';

const H1 = 3_600_000;
const M5 = 300_000;

// A tick at a given minute of the hour; every timeframe field derived from it.
function tick(symbol: string, hourMs: number, minute: number, bid: number, over: Partial<TickData> = {}): TickData {
  const m5 = hourMs + Math.floor(minute / 5) * M5;
  return {
    symbol, bid, ask: bid + 0.0002, time: hourMs + minute * 60_000, broker_offset: 2,
    m5_time: m5, m5_open: bid - 0.0001, m5_high: bid + 0.0003, m5_low: bid - 0.0003,
    m15_time: hourMs + Math.floor(minute / 15) * 3 * M5, m15_open: bid, m15_high: bid, m15_low: bid,
    h1_time: hourMs, h1_open: 1.1000, h1_high: 1.1050, h1_low: 1.0990,
    h4_time: hourMs - (hourMs % (4 * H1)), h4_open: 1.1, h4_high: 1.1, h4_low: 1.1,
    d1_time: hourMs - (hourMs % (24 * H1)), d1_open: 1.1, d1_high: 1.1, d1_low: 1.1,
    ...over,
  };
}

const hour = Date.UTC(2026, 9, 23, 10);

describe('trackCandleCloses', () => {
  it('seeds on the first tick and reports nothing while the candle times hold', () => {
    const state = createCandleCloseState();
    expect(trackCandleCloses(state, 'ftmo', [tick('EURUSD', hour, 0, 1.1010)])).toEqual([]);
    expect(trackCandleCloses(state, 'ftmo', [tick('EURUSD', hour, 3, 1.1020)])).toEqual([]);
  });

  it('closes the M5 candle with the previous OHLC and the last bid when m5_time advances', () => {
    const state = createCandleCloseState();
    trackCandleCloses(state, 'ftmo', [tick('EURUSD', hour, 1, 1.1010)]);
    trackCandleCloses(state, 'ftmo', [tick('EURUSD', hour, 4, 1.1025, { m5_high: 1.1030, m5_low: 1.1005, m5_open: 1.1012 })]);
    const closed = trackCandleCloses(state, 'ftmo', [tick('EURUSD', hour, 5, 1.1040)]);
    expect(closed).toEqual([
      { symbol: 'EURUSD', timeframe: 'M5', time: hour, open: 1.1012, high: 1.1030, low: 1.1005, close: 1.1025 },
    ]);
  });

  it('closes every timeframe whose time changed, once, and keeps brokers and symbols apart', () => {
    const state = createCandleCloseState();
    trackCandleCloses(state, 'ftmo', [tick('EURUSD', hour, 55, 1.1010), tick('GBPUSD', hour, 55, 1.3)]);
    trackCandleCloses(state, 'darwinex', [tick('EURUSD', hour, 55, 1.1011)]);
    const closed = trackCandleCloses(state, 'ftmo', [tick('EURUSD', hour + H1, 0, 1.1050)]);
    expect(closed.map(c => c.timeframe).sort()).toEqual(['H1', 'M15', 'M5']);
    expect(closed.every(c => c.symbol === 'EURUSD' && c.close === 1.1010)).toBe(true);
    expect(closed.find(c => c.timeframe === 'H1')).toMatchObject({ time: hour, open: 1.1, high: 1.105, low: 1.099 });
    // The other symbol and the other broker are untouched.
    expect(trackCandleCloses(state, 'ftmo', [tick('GBPUSD', hour, 58, 1.31)])).toEqual([]);
    expect(trackCandleCloses(state, 'darwinex', [tick('EURUSD', hour, 59, 1.1012)])).toEqual([]);
  });

  it('stores nothing for a stale bar a terminal reports next to the live bid', () => {
    const state = createCandleCloseState();
    const staleHour = Date.UTC(2026, 9, 20, 13);
    const now = Date.UTC(2026, 10, 16, 16);
    const stale = { time: now, h1_time: staleHour, h1_open: 1.1215, h1_high: 1.1219, h1_low: 1.1209, m5_time: staleHour + 9 * M5, m15_time: staleHour + 9 * M5 };
    trackCandleCloses(state, 'ftmo', [tick('EURUSD', staleHour, 45, 1.1003, stale)]);
    const closed = trackCandleCloses(state, 'ftmo', [tick('EURUSD', now, 0, 1.1003, { time: now + 1000 })]);
    expect(closed).toEqual([]);
  });

  it('stores nothing when the last bid lies outside the bar range', () => {
    const state = createCandleCloseState();
    trackCandleCloses(state, 'ftmo', [tick('EURUSD', hour, 4, 1.1003, { m5_open: 1.1212, m5_high: 1.1213, m5_low: 1.1210 })]);
    const closed = trackCandleCloses(state, 'ftmo', [tick('EURUSD', hour, 5, 1.1004)]);
    expect(closed.filter(c => c.timeframe === 'M5')).toEqual([]);
  });

  it('still closes a bar whose symbol stayed quiet into the next period', () => {
    const state = createCandleCloseState();
    const quiet = { time: hour + 6 * 60_000, m5_time: hour, m5_open: 1.1012, m5_high: 1.1030, m5_low: 1.1005 };
    trackCandleCloses(state, 'ftmo', [tick('EURUSD', hour, 4, 1.1025, quiet)]);
    const closed = trackCandleCloses(state, 'ftmo', [tick('EURUSD', hour, 7, 1.1026)]);
    expect(closed.filter(c => c.timeframe === 'M5')).toEqual([
      { symbol: 'EURUSD', timeframe: 'M5', time: hour, open: 1.1012, high: 1.1030, low: 1.1005, close: 1.1025 },
    ]);
  });

  it('closes the last bar of Friday at the Monday open: the server clock stops over the weekend', () => {
    const state = createCandleCloseState();
    const fridayLastHour = Date.UTC(2026, 9, 23, 23);
    const monday = Date.UTC(2026, 9, 26, 0);
    const brokerOffsetS = 7200;
    const serverFriday = fridayLastHour + 59 * 60_000;
    // Sunday evening GMT: the wall clock moved on, the offset shrank with it, their sum is still Friday's last quote.
    const sundayGmt = Date.UTC(2026, 9, 25, 21);
    const weekend = { time: sundayGmt, broker_offset: (serverFriday - sundayGmt) / 1000, h1_time: fridayLastHour };
    trackCandleCloses(state, 'ftmo', [tick('EURUSD', fridayLastHour, 59, 1.1010, weekend)]);
    const closed = trackCandleCloses(state, 'ftmo', [tick('EURUSD', monday, 0, 1.1015, { time: monday - brokerOffsetS * 1000, broker_offset: brokerOffsetS })]);
    expect(closed.find(c => c.timeframe === 'H1')).toMatchObject({ time: fridayLastHour, close: 1.1010 });
  });

  it('skips a tick whose candle time is missing', () => {
    const state = createCandleCloseState();
    trackCandleCloses(state, 'ftmo', [tick('EURUSD', hour, 0, 1.1)]);
    const closed = trackCandleCloses(state, 'ftmo', [tick('EURUSD', hour, 5, 1.1, { m5_time: Number.NaN })]);
    expect(closed).toEqual([]);
  });
});
