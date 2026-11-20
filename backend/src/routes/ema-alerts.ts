import { Router } from 'express';
import { db } from '../db/client';
import type { AuthRequest } from '../middleware/requireAuth';
import { refreshEmaAlerts } from '../alerts/ema-alert-store';
import { asyncRoute } from '../middleware/asyncRoute';
import { isMaType, type MaType } from '../indicators/moving-average';

const router = Router();

type Direction = 'buy' | 'sell' | 'both';

interface EmaAlertBody {
  broker?: string;
  symbol?: string;
  timeframe?: string;
  emaFast?: number;
  emaSlow?: number;
  fastType?: MaType;
  slowType?: MaType;
  direction?: Direction;
  thresholdPips?: number;
  note?: string | null;
  enabled?: boolean;
}

const positiveInt = (v: unknown): boolean => Number.isInteger(v) && (v as number) > 0;

// Per-field rules shared by the full (POST) and partial (PUT) validation.
const FIELD_RULES: Record<keyof EmaAlertBody, (v: unknown) => string | null> = {
  broker: v => (typeof v === 'string' && v !== '' ? null : 'broker must be a non-empty string'),
  symbol: v => (typeof v === 'string' && v !== '' ? null : 'symbol must be a non-empty string'),
  timeframe: v => (typeof v === 'string' && v !== '' ? null : 'timeframe must be a non-empty string'),
  emaFast: v => (positiveInt(v) ? null : 'emaFast must be a positive integer'),
  emaSlow: v => (positiveInt(v) ? null : 'emaSlow must be a positive integer'),
  fastType: v => (isMaType(v) ? null : 'fastType must be "ema" or "sma"'),
  slowType: v => (isMaType(v) ? null : 'slowType must be "ema" or "sma"'),
  direction: v => (v === 'buy' || v === 'sell' || v === 'both' ? null : 'direction must be "buy", "sell" or "both"'),
  thresholdPips: v => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? null : 'thresholdPips must be a positive number'),
  note: v => (v === null || typeof v === 'string' ? null : 'note must be a string or null'),
  enabled: v => (typeof v === 'boolean' ? null : 'enabled must be a boolean'),
};

function validate(body: EmaAlertBody): string | null {
  if (!body.broker || !body.symbol || !body.timeframe) return 'broker, symbol and timeframe are required';
  if (!Number.isInteger(body.emaFast) || !Number.isInteger(body.emaSlow)) return 'emaFast and emaSlow must be integers';
  if ((body.emaFast as number) <= 0 || (body.emaSlow as number) <= 0) return 'emaFast and emaSlow must be positive';
  if (body.direction !== 'buy' && body.direction !== 'sell' && body.direction !== 'both') return 'direction must be "buy", "sell" or "both"';
  if (typeof body.thresholdPips !== 'number' || !Number.isFinite(body.thresholdPips) || body.thresholdPips <= 0) return 'thresholdPips must be a positive number';
  return validatePartial(body);
}

// Only the fields present are checked; `current` supplies the other EMA period
// so the "must differ" rule holds when just one of them is sent.
function validatePartial(body: EmaAlertBody, current?: { emaFast: number; emaSlow: number; fastType: string; slowType: string }): string | null {
  for (const [field, rule] of Object.entries(FIELD_RULES) as [keyof EmaAlertBody, (v: unknown) => string | null][]) {
    if (body[field] === undefined) continue;
    const error = rule(body[field]);
    if (error) return error;
  }
  const fast = body.emaFast ?? current?.emaFast;
  const slow = body.emaSlow ?? current?.emaSlow;
  const fastType = body.fastType ?? current?.fastType ?? 'ema';
  const slowType = body.slowType ?? current?.slowType ?? 'ema';
  if (fast !== undefined && slow !== undefined && fast === slow && fastType === slowType) return 'emaFast and emaSlow must differ for the same type';
  return null;
}

router.get('/', asyncRoute<AuthRequest>(async (req, res) => {
  const alerts = await db.emaCrossAlert.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: 'desc' },
  });
  res.json(alerts);
}));

router.post('/', asyncRoute<AuthRequest>(async (req, res) => {
  const body = req.body as EmaAlertBody;
  const error = validate(body);
  if (error) { res.status(400).json({ message: error }); return; }

  const alert = await db.emaCrossAlert.create({
    data: {
      userId: req.userId!,
      broker: body.broker!,
      symbol: body.symbol!,
      timeframe: body.timeframe!,
      emaFast: body.emaFast!,
      emaSlow: body.emaSlow!,
      fastType: body.fastType ?? 'ema',
      slowType: body.slowType ?? 'ema',
      direction: body.direction!,
      thresholdPips: body.thresholdPips!,
      note: body.note ?? null,
    },
  });
  await refreshEmaAlerts();
  res.status(201).json(alert);
}));

router.put('/:id', asyncRoute<AuthRequest>(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ message: 'invalid id' }); return; }

  const body = req.body as EmaAlertBody;
  const typeError = validatePartial(body);
  if (typeError) { res.status(400).json({ message: typeError }); return; }

  const existing = await db.emaCrossAlert.findFirst({ where: { id, userId: req.userId! } });
  if (!existing) { res.status(404).json({ message: 'alert not found' }); return; }

  const mergeError = validatePartial(body, existing);
  if (mergeError) { res.status(400).json({ message: mergeError }); return; }

  // re-arming (enabled true) clears the previous trigger so it can fire again
  const reArmed = body.enabled === true && !existing.enabled;

  const alert = await db.emaCrossAlert.update({
    where: { id },
    data: {
      ...(body.broker !== undefined ? { broker: body.broker } : {}),
      ...(body.symbol !== undefined ? { symbol: body.symbol } : {}),
      ...(body.timeframe !== undefined ? { timeframe: body.timeframe } : {}),
      ...(body.emaFast !== undefined ? { emaFast: body.emaFast } : {}),
      ...(body.emaSlow !== undefined ? { emaSlow: body.emaSlow } : {}),
      ...(body.fastType !== undefined ? { fastType: body.fastType } : {}),
      ...(body.slowType !== undefined ? { slowType: body.slowType } : {}),
      ...(body.direction !== undefined ? { direction: body.direction } : {}),
      ...(body.thresholdPips !== undefined ? { thresholdPips: body.thresholdPips } : {}),
      ...(body.note !== undefined ? { note: body.note } : {}),
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
      ...(reArmed ? { triggeredAt: null } : {}),
    },
  });
  await refreshEmaAlerts();
  res.json(alert);
}));

router.delete('/:id', asyncRoute<AuthRequest>(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ message: 'invalid id' }); return; }

  const result = await db.emaCrossAlert.deleteMany({ where: { id, userId: req.userId! } });
  if (result.count === 0) { res.status(404).json({ message: 'alert not found' }); return; }
  await refreshEmaAlerts();
  res.status(204).end();
}));

export default router;
