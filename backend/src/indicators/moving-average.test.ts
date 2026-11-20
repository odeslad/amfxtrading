import { describe, it, expect } from 'vitest';
import type { Candle } from './ema';
import { calculateMa, isMaType, maLabel } from './moving-average';
import { calculateSma } from './sma';

const candlesFromCloses = (closes: number[]): Candle[] =>
  closes.map((close, i) => ({ time: new Date(Date.UTC(2026, 0, 1, i)), open: close, high: close, low: close, close }));

describe('calculateSma', () => {
  it('is null until the period is reached', () => {
    expect(calculateSma(candlesFromCloses([1, 2]), 3)).toEqual([null, null]);
  });

  it('averages the last period closes, like the chart', () => {
    expect(calculateSma(candlesFromCloses([1, 2, 3, 4, 5, 9]), 3)).toEqual([null, null, 2, 3, 4, 6]);
  });
});

describe('calculateMa', () => {
  const candles = candlesFromCloses([1, 2, 3, 4, 5, 6]);

  it('dispatches on the type', () => {
    expect(calculateMa(candles, 'sma', 3)).toEqual([null, null, 2, 3, 4, 5]);
    expect(calculateMa(candles, 'ema', 3)).toEqual([null, null, 2, 3, 4, 5]);
    expect(calculateMa(candlesFromCloses([1, 2, 3, 10]), 'sma', 3)[3]).toBe(5);
    expect(calculateMa(candlesFromCloses([1, 2, 3, 10]), 'ema', 3)[3]).toBe(6);
  });

  it('validates and labels types', () => {
    expect(isMaType('sma')).toBe(true);
    expect(isMaType('wma')).toBe(false);
    expect(maLabel('sma', 20)).toBe('SMA 20');
  });
});
