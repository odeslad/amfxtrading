import { describe, it, expect } from 'vitest';
import { closedBars, toColumns } from './candles';

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

describe('toColumns', () => {
  it('lines every field up by position', () => {
    const columns = toColumns([{ time: 100, open: 1.1, high: 1.3, low: 1.0, close: 1.2 }, { time: 200, open: 2.1, high: 2.3, low: 2.0, close: 2.2 }]);
    expect(columns).toEqual({ times: [100, 200], opens: [1.1, 2.1], highs: [1.3, 2.3], lows: [1.0, 2.0], closes: [1.2, 2.2] });
  });
});
