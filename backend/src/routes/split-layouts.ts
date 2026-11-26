import { Router } from 'express';
import { db } from '../db/client';
import { config } from '../config';
import type { AuthRequest } from '../middleware/requireAuth';
import { asyncRoute } from '../middleware/asyncRoute';
import { BadRequest } from '../middleware/errors';
import { bodyRecord, nonEmptyString, oneOf } from '../middleware/parse';

// Spec 063: named split layouts per user — the broker, pair and timeframe of each chart.
// Settings saves the whole list at once (autosave), so PUT replaces the user's rows.

export const LAYOUT_TIMEFRAMES = ['M5', 'M15', 'H1', 'H4', 'D1'] as const;
const NAME_MAX = 40;
const MAX_LAYOUTS = 20;

export interface ChartSide {
  broker: string;
  symbol: string;
  timeframe: (typeof LAYOUT_TIMEFRAMES)[number];
}

export interface SplitLayoutInput {
  id?: number;
  name: string;
  left: ChartSide;
  right: ChartSide;
}

let notify: (userId: number) => void = () => {};
export const setSplitLayoutsBroadcaster = (fn: (userId: number) => void): void => { notify = fn; };

function parseSide(raw: unknown, field: string, brokers: readonly string[]): ChartSide {
  const side = bodyRecord(raw);
  const broker = nonEmptyString(side['broker'], `${field}.broker`);
  if (!brokers.includes(broker)) throw new BadRequest(`${field}.broker is not a known broker`);
  return {
    broker,
    symbol: nonEmptyString(side['symbol'], `${field}.symbol`).trim().toUpperCase(),
    timeframe: oneOf(side['timeframe'], `${field}.timeframe`, LAYOUT_TIMEFRAMES),
  };
}

export function parseLayouts(value: unknown, brokers: readonly string[]): SplitLayoutInput[] {
  if (!Array.isArray(value)) throw new BadRequest('layouts must be an array');
  if (value.length > MAX_LAYOUTS) throw new BadRequest(`at most ${MAX_LAYOUTS} layouts`);
  const names = new Set<string>();
  return value.map((raw, i) => {
    const layout = bodyRecord(raw);
    const name = nonEmptyString(layout['name'], `layouts[${i}].name`).trim();
    if (name.length === 0 || name.length > NAME_MAX) throw new BadRequest(`layouts[${i}].name must have 1 to ${NAME_MAX} characters`);
    if (names.has(name.toLowerCase())) throw new BadRequest(`layouts[${i}].name is repeated`);
    names.add(name.toLowerCase());
    const id = layout['id'];
    if (id !== undefined && (typeof id !== 'number' || !Number.isInteger(id) || id < 1)) throw new BadRequest(`layouts[${i}].id must be a positive integer`);
    return {
      ...(id !== undefined ? { id } : {}),
      name,
      left: parseSide(layout['left'], `layouts[${i}].left`, brokers),
      right: parseSide(layout['right'], `layouts[${i}].right`, brokers),
    };
  });
}

interface LayoutRow {
  id: number;
  name: string;
  leftBroker: string;
  leftSymbol: string;
  leftTimeframe: string;
  rightBroker: string;
  rightSymbol: string;
  rightTimeframe: string;
}

const toResponse = (r: LayoutRow) => ({
  id: r.id,
  name: r.name,
  left: { broker: r.leftBroker, symbol: r.leftSymbol, timeframe: r.leftTimeframe },
  right: { broker: r.rightBroker, symbol: r.rightSymbol, timeframe: r.rightTimeframe },
});

const columns = (l: SplitLayoutInput, position: number) => ({
  name: l.name,
  position,
  leftBroker: l.left.broker, leftSymbol: l.left.symbol, leftTimeframe: l.left.timeframe,
  rightBroker: l.right.broker, rightSymbol: l.right.symbol, rightTimeframe: l.right.timeframe,
});

const list = (userId: number) => db.splitLayout.findMany({ where: { userId }, orderBy: [{ position: 'asc' }, { id: 'asc' }] });

const router = Router();

router.get('/', asyncRoute<AuthRequest>(async (req, res) => {
  res.json((await list(req.userId!)).map(toResponse));
}));

router.put('/', asyncRoute<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const layouts = parseLayouts(bodyRecord(req.body)['layouts'], config.brokers.map(b => b.name));
  const keepIds = layouts.flatMap(l => (l.id === undefined ? [] : [l.id]));

  await db.$transaction(async (tx) => {
    const owned = await tx.splitLayout.findMany({ where: { userId }, select: { id: true } });
    const ownedIds = new Set(owned.map(o => o.id));
    if (keepIds.some(id => !ownedIds.has(id))) throw new BadRequest('layouts contain an id that is not yours');
    await tx.splitLayout.deleteMany({ where: { userId, id: { notIn: keepIds } } });
    // Names are unique per user: free them first so a swap of two names does not collide.
    for (const id of keepIds) await tx.splitLayout.update({ where: { id }, data: { name: `__renaming_${id}` } });
    for (const [position, l] of layouts.entries()) {
      if (l.id !== undefined) await tx.splitLayout.update({ where: { id: l.id }, data: columns(l, position) });
      else await tx.splitLayout.create({ data: { userId, ...columns(l, position) } });
    }
  });

  notify(userId);
  res.json((await list(userId)).map(toResponse));
}));

export default router;
