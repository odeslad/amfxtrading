import { Router } from 'express';
import { db } from '../db/client';
import type { AuthRequest } from '../middleware/requireAuth';
import { asyncRoute } from '../middleware/asyncRoute';
import { BadRequest } from '../middleware/errors';
import { bodyRecord, nonEmptyString } from '../middleware/parse';

const router = Router();

router.get('/', asyncRoute<AuthRequest>(async (_req, res) => {
  const brokers = await db.balance.findMany({
    distinct: ['broker'],
    orderBy: { timestamp: 'desc' },
    // `day` is an internal key; the response keeps today's shape.
    select: {
      id: true, broker: true, balance: true, equity: true, profit: true, margin: true,
      freeMargin: true, leverage: true, currency: true, name: true, number: true, timestamp: true,
    },
  });

  const colors = new Map((await db.accountColor.findMany()).map(c => [c.broker, c.color]));
  res.json(brokers.map(b => ({ ...b, color: colors.get(b.broker) ?? '' })));
}));

const MAX_COLOR_LENGTH = 20;

// Spec 055: the account's colour in Journal › Accounts; an empty colour clears it.
export function parseAccountColor(raw: unknown): { broker: string; color: string } {
  const body = bodyRecord(raw);
  const broker = nonEmptyString(body.broker, 'broker');
  const color = body.color ?? '';
  if (typeof color !== 'string' || color.length > MAX_COLOR_LENGTH) {
    throw new BadRequest(`color must be a string of at most ${MAX_COLOR_LENGTH} characters`);
  }
  return { broker, color };
}

router.patch('/color', asyncRoute<AuthRequest>(async (req, res) => {
  const { broker, color } = parseAccountColor(req.body);
  if (color === '') await db.accountColor.deleteMany({ where: { broker } });
  else await db.accountColor.upsert({ where: { broker }, update: { color }, create: { broker, color } });
  res.json({ ok: true });
}));

export default router;
