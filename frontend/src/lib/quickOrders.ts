// Spec 054: the one quick order configuration used by the chart's context menu.
export type QuickLotsMode = 'fixed' | 'risk_pct';
export type QuickTpMode = 'pips' | 'r';

export interface QuickOrders {
  lotsMode: QuickLotsMode;
  size: number;
  slPips: number | null;
  tpMode: QuickTpMode | null;
  tp: number | null;
  mirrorPresetId: number | null;
}

export const DEFAULT_QUICK_ORDERS: QuickOrders = {
  lotsMode: 'fixed', size: 0.01, slPips: null, tpMode: null, tp: null, mirrorPresetId: null,
};

// Same rules as the backend (routes/quick-orders.ts), so Save explains what is wrong.
export function quickOrdersError(q: QuickOrders | null): string | null {
  if (q === null) return null;
  if (!(q.size > 0)) return 'Quick orders: the size must be greater than 0';
  if (q.slPips !== null && !(q.slPips > 0)) return 'Quick orders: the stop loss must be greater than 0';
  if (q.tpMode !== null && !(q.tp !== null && q.tp > 0)) return 'Quick orders: the take profit must be greater than 0';
  if (q.lotsMode === 'risk_pct' && q.slPips === null) return 'Quick orders: risk % needs a stop loss';
  if (q.tpMode === 'r' && q.slPips === null) return 'Quick orders: a take profit in R needs a stop loss';
  return null;
}
