import { newCommandId, type Command, type CommandAction } from './commands';
import { orderTypeAt, type Side } from './orderType';
import { pipSize, pricePrecision } from '../features/journal/utils/position';

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

export interface QuickPresetBroker {
  broker: string;
  enabled: boolean;
  lotsMode: QuickLotsMode;
  lots: number;
}

export interface QuickPreset {
  id: number;
  name: string;
  brokers: QuickPresetBroker[];
}

export interface QuickOrderRequest {
  side: Side;
  broker: string;
  symbol: string;
  price: number | null;      // null = at market
  bid: number;
  ask: number;
  presets: QuickPreset[];
}

export interface QuickOrderPlan {
  action: CommandAction;
  entry: number;
  sl: number;
  tp: number;
  slPips: number | null;
  tpLabel: string | null;
  presetName: string | null;
  targets: Array<{ broker: string; lots: number; lotsMode: QuickLotsMode }>;
  commands: Command[];
}

export type QuickOrderResult = { plan: QuickOrderPlan } | { error: string };

// The commands a quick order sends, as New Trade would: one per enabled preset broker with
// its own size, or the chart's broker with the configured size. SL/TP are measured from the
// entry: the clicked price for a pending order, ask/bid at market.
export function buildQuickOrder(config: QuickOrders, req: QuickOrderRequest): QuickOrderResult {
  const { side, symbol, bid, ask } = req;
  const buy = side === 'buy';
  const precision = pricePrecision(symbol);
  const round = (v: number) => Number(v.toFixed(precision));
  const entry = req.price ?? (buy ? ask : bid);
  if (!Number.isFinite(entry) || entry <= 0) return { error: 'No live price for this symbol' };
  const action: CommandAction = req.price === null ? side : orderTypeAt(side, req.price, bid, ask);

  const slDistance = config.slPips !== null ? config.slPips * pipSize(symbol) : null;
  const sl = slDistance !== null ? round(buy ? entry - slDistance : entry + slDistance) : 0;
  let tp = 0;
  let tpLabel: string | null = null;
  if (config.tpMode !== null && config.tp !== null) {
    const distance = config.tpMode === 'pips' ? config.tp * pipSize(symbol) : (slDistance ?? 0) * config.tp;
    tp = distance > 0 ? round(buy ? entry + distance : entry - distance) : 0;
    tpLabel = config.tpMode === 'pips' ? `${config.tp} p` : `${config.tp}R`;
  }

  const preset = config.mirrorPresetId !== null ? req.presets.find(p => p.id === config.mirrorPresetId) ?? null : null;
  const targets = preset
    ? preset.brokers.filter(b => b.enabled).map(b => ({ broker: b.broker, lots: b.lots, lotsMode: b.lotsMode }))
    : [{ broker: req.broker, lots: config.size, lotsMode: config.lotsMode }];
  if (targets.length === 0) return { error: `Preset "${preset?.name}" has no enabled broker` };
  if (sl === 0 && targets.some(t => t.lotsMode === 'risk_pct')) return { error: 'Risk % sizing needs a stop loss in the quick order settings' };

  const commands: Command[] = targets.map(t => ({
    id: newCommandId(), action, broker: t.broker, symbol: symbol.toUpperCase(), lots: t.lots, lotsMode: t.lotsMode, sl, tp,
    ...(req.price !== null ? { price: round(req.price) } : {}),
  }));
  return { plan: { action, entry: round(entry), sl, tp, slPips: config.slPips, tpLabel, presetName: preset?.name ?? null, targets, commands } };
}
