// EMA cross trades overlay (spec 039): parameters chosen in Settings > Display.
import type { MaType } from './chart.types';

export const EMA_TRADES_LABEL_KEYS = ['price', 'r', 'pips'] as const;
export type EmaTradesLabel = (typeof EMA_TRADES_LABEL_KEYS)[number];

export const EMA_TRADES_LABEL_NAMES: Record<EmaTradesLabel, string> = { price: 'Price', r: 'R multiple', pips: 'Pips' };

export interface EmaTradesSettings {
  fast: number;
  slow: number;
  fastType: MaType;
  slowType: MaType;
  entryPips: number;
  candles: number;
  count: number;
  tpRatio: number;
  labels: EmaTradesLabel[];
}

export const DEFAULT_EMA_TRADES: EmaTradesSettings = {
  fast: 24, slow: 48, fastType: 'ema', slowType: 'ema', entryPips: 5, candles: 24, count: 3, tpRatio: 2, labels: [...EMA_TRADES_LABEL_KEYS],
};

export type EmaTradesNumberKey = Exclude<keyof EmaTradesSettings, 'labels' | 'fastType' | 'slowType'>;

export const EMA_TRADES_LIMITS = {
  candles: { min: 1, max: 50 },
  count: { min: 1, max: 10 },
  tpRatio: { min: 0.5, max: 10 },
} as const;
