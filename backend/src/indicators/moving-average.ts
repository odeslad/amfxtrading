import { calculateEma, type Candle } from './ema';
import { calculateSma } from './sma';

export const MA_TYPES = ['ema', 'sma'] as const;
export type MaType = (typeof MA_TYPES)[number];

export function isMaType(value: unknown): value is MaType {
  return typeof value === 'string' && (MA_TYPES as readonly string[]).includes(value);
}

export function calculateMa(candles: Candle[], type: MaType, period: number): (number | null)[] {
  return type === 'sma' ? calculateSma(candles, period) : calculateEma(candles, period);
}

export function maLabel(type: MaType, period: number): string {
  return `${type.toUpperCase()} ${period}`;
}
