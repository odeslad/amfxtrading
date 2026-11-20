import type { Prisma } from '@prisma/client';
import { BadRequest } from '../middleware/errors';
import { bodyRecord, finiteNumber, integer, oneOf } from '../middleware/parse';

// Spec 054: the one quick order configuration used by the chart's context menu.
export const QUICK_LOTS_MODES = ['fixed', 'risk_pct'] as const;
export const QUICK_TP_MODES = ['pips', 'r'] as const;

export interface QuickOrders {
  lotsMode: (typeof QUICK_LOTS_MODES)[number];
  size: number;
  slPips: number | null;
  tpMode: (typeof QUICK_TP_MODES)[number] | null;
  tp: number | null;
  mirrorPresetId: number | null;
}

const KEY = 'display.quickOrders';

const positiveOrNull = (value: unknown, key: string): number | null =>
  value === null || value === undefined ? null : finiteNumber(value, key, { positive: true });

// undefined = keep the stored value; null = clear it.
export function parseQuickOrders(value: unknown): QuickOrders | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const row = bodyRecord(value);
  const lotsMode = oneOf(row.lotsMode, `${KEY}.lotsMode`, QUICK_LOTS_MODES);
  const size = finiteNumber(row.size, `${KEY}.size`, { positive: true });
  const slPips = positiveOrNull(row.slPips, `${KEY}.slPips`);
  const tpMode = row.tpMode === null || row.tpMode === undefined ? null : oneOf(row.tpMode, `${KEY}.tpMode`, QUICK_TP_MODES);
  const tp = positiveOrNull(row.tp, `${KEY}.tp`);
  const mirrorPresetId = row.mirrorPresetId === null || row.mirrorPresetId === undefined
    ? null : integer(row.mirrorPresetId, `${KEY}.mirrorPresetId`, { min: 1 });

  if ((tpMode === null) !== (tp === null)) throw new BadRequest(`${KEY}.tpMode and tp go together`);
  if (tpMode === 'r' && slPips === null) throw new BadRequest(`${KEY}: a take profit in R needs a stop loss`);
  if (lotsMode === 'risk_pct' && slPips === null) throw new BadRequest(`${KEY}: risk % sizing needs a stop loss`);
  return { lotsMode, size, slPips, tpMode, tp, mirrorPresetId };
}

// A stored value that no longer parses reads as not configured; a deleted preset reads as none.
export function readQuickOrders(value: Prisma.JsonValue | undefined, presetIds: number[]): QuickOrders | null {
  if (value === undefined || value === null) return null;
  try {
    const parsed = parseQuickOrders(value);
    if (!parsed) return null;
    return parsed.mirrorPresetId !== null && !presetIds.includes(parsed.mirrorPresetId)
      ? { ...parsed, mirrorPresetId: null }
      : parsed;
  } catch {
    return null;
  }
}
