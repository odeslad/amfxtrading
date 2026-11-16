import { describe, it, expect } from 'vitest';
import { closedBars, historyRange, historyStart, toColumns, MIN_BARS_TO_TRIM } from './candles';

const bar = (time: number, close: number) => ({ time, open: 1.1, high: 1.2, low: 1.0, close });

describe('closedBars', () => {
  it('drops the bar that is still forming', () => {
    expect(closedBars([bar(100, 1.11), bar(200, 1.12), bar(300, 1.13)]).map((c) => c.time)).toEqual([100, 200]);
  });

  it('returns nothing for a file with only the forming bar, or none', () => {
    expect(closedBars([bar(100, 1.11)])).toEqual([]);
    expect(closedBars([])).toEqual([]);
  });

  it('keeps the last values of a time repeated in the file', () => {
    const bars = closedBars([bar(100, 1.11), bar(200, 1.12), bar(100, 1.15), bar(300, 1.13)]);
    expect(bars).toEqual([bar(100, 1.15), bar(200, 1.12)]);
  });
});

describe('historyStart', () => {
  const bars = (count: number) => Array.from({ length: count }, (_, i) => bar(1_000 + i * 300, 1.1));

  it('is the oldest bar of a history long enough to be trusted', () => {
    expect(historyStart(bars(MIN_BARS_TO_TRIM))).toBe(1_000);
    expect(historyStart([...bars(MIN_BARS_TO_TRIM)].reverse())).toBe(1_000);
  });

  it('is unknown for a short history, so nothing stored is dropped', () => {
    expect(historyStart(bars(MIN_BARS_TO_TRIM - 1))).toBeNull();
    expect(historyStart([])).toBeNull();
  });
});

describe('historyRange', () => {
  const bars = (count: number) => Array.from({ length: count }, (_, i) => bar(1_000 + i * 300, 1.1));

  it('spans from the oldest to the newest bar, whatever their order', () => {
    const last = 1_000 + (MIN_BARS_TO_TRIM - 1) * 300;
    expect(historyRange(bars(MIN_BARS_TO_TRIM))).toEqual({ first: 1_000, last });
    expect(historyRange([...bars(MIN_BARS_TO_TRIM)].reverse())).toEqual({ first: 1_000, last });
  });

  it('is unknown for a short history, so nothing stored is dropped', () => {
    expect(historyRange(bars(MIN_BARS_TO_TRIM - 1))).toBeNull();
  });
});

describe('toColumns', () => {
  it('lines every field up by position', () => {
    const columns = toColumns([{ time: 100, open: 1.1, high: 1.3, low: 1.0, close: 1.2 }, { time: 200, open: 2.1, high: 2.3, low: 2.0, close: 2.2 }]);
    expect(columns).toEqual({ times: [100, 200], opens: [1.1, 2.1], highs: [1.3, 2.3], lows: [1.0, 2.0], closes: [1.2, 2.2] });
  });
});
