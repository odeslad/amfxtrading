export type MaType = 'ema' | 'sma';

// One moving average of a template (spec 052).
export interface MovingAverage {
  id: string;
  type: MaType;
  period: number;
  color: string;
  style: 'solid' | 'dashed' | 'dotted';
  width: 1 | 2 | 3;
}
