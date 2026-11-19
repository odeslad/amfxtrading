import type { MovingAverage } from './chart.types';

export const PALETTE = [
  '#f5a623', '#3a7bd5', '#4caf84', '#e05c5c',
  '#c8a840', '#a78bfa', '#22d3ee', '#f472b6',
  '#ef4444', '#84cc16', '#0ea5e9', '#f97316',
  '#ffffff', '#aaaaaa', '#555555', '#14b8a6',
];

// "EMA 24", "SMA 200": how an average is named everywhere (spec 052).
export const maLabel = (a: Pick<MovingAverage, 'type' | 'period'>): string => `${a.type.toUpperCase()} ${a.period}`;
