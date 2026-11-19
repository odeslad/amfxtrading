import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { db } from '../db/client';
import type { AuthRequest } from '../middleware/requireAuth';
import { asyncRoute } from '../middleware/asyncRoute';
import { BadRequest, Conflict, NotFound } from '../middleware/errors';
import { bodyRecord, integer, nonEmptyString, oneOf } from '../middleware/parse';

// Spec 052: moving average templates (EMA / SMA) and the template of each broker.
// Brokers without an assignment use the user's default template, which always exists
// and cannot be deleted; there is exactly one default per user.

export const MA_TYPES = ['ema', 'sma'] as const;
export const LINE_STYLES = ['solid', 'dashed', 'dotted'] as const;
// A template can be assigned to one timeframe of a broker; without one it covers them all.
export const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN'] as const;
const NAME_MAX = 40;
const COLOR = /^#[0-9a-fA-F]{6}$/;

export interface MovingAverage {
  id: string;
  type: (typeof MA_TYPES)[number];
  period: number;
  color: string;
  style: (typeof LINE_STYLES)[number];
  width: number;
}

let notify: (userId: number) => void = () => {};
export const setMaTemplatesBroadcaster = (fn: (userId: number) => void): void => { notify = fn; };

export function parseName(value: unknown): string {
  const name = nonEmptyString(value, 'name').trim();
  if (name.length === 0 || name.length > NAME_MAX) throw new BadRequest(`name must have 1 to ${NAME_MAX} characters`);
  return name;
}

// Same rule as the old EMA list: a whole period of 1 or more, no upper limit, no limit on the count.
export function parseAverages(value: unknown): MovingAverage[] {
  if (!Array.isArray(value)) throw new BadRequest('averages must be an array');
  const ids = new Set<string>();
  return value.map((raw, i) => {
    const a = bodyRecord(raw);
    const id = nonEmptyString(a['id'], `averages[${i}].id`);
    if (ids.has(id)) throw new BadRequest(`averages[${i}].id is repeated`);
    ids.add(id);
    const color = nonEmptyString(a['color'], `averages[${i}].color`);
    if (!COLOR.test(color)) throw new BadRequest(`averages[${i}].color must be #rrggbb`);
    const width = integer(a['width'], `averages[${i}].width`, { min: 1 });
    if (width > 3) throw new BadRequest(`averages[${i}].width must be 1 to 3`);
    return {
      id,
      type: oneOf(a['type'], `averages[${i}].type`, MA_TYPES),
      period: integer(a['period'], `averages[${i}].period`, { min: 1 }),
      color,
      style: oneOf(a['style'], `averages[${i}].style`, LINE_STYLES),
      width,
    };
  });
}

const json = (averages: MovingAverage[]): Prisma.InputJsonValue => averages as unknown as Prisma.InputJsonValue;

const templateId = (raw: string | undefined): number => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) throw new BadRequest('id must be a positive integer');
  return id;
};

async function ownTemplate(userId: number, id: number) {
  const template = await db.maTemplate.findFirst({ where: { id, userId } });
  if (!template) throw new NotFound('Template not found');
  return template;
}

const router = Router();

router.get('/', asyncRoute<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  let templates = await db.maTemplate.findMany({ where: { userId }, orderBy: { id: 'asc' } });
  if (!templates.some((t) => t.isDefault)) {
    await db.maTemplate.create({ data: { userId, name: 'Default', isDefault: true, averages: [] } });
    templates = await db.maTemplate.findMany({ where: { userId }, orderBy: { id: 'asc' } });
  }
  const rows = await db.maTemplateBroker.findMany({ where: { userId }, orderBy: [{ broker: 'asc' }, { timeframe: 'asc' }] });
  res.json({
    templates: templates.map((t) => ({ id: t.id, name: t.name, isDefault: t.isDefault, averages: t.averages })),
    assignments: rows.map((r) => ({ broker: r.broker, timeframe: r.timeframe || null, templateId: r.templateId })),
  });
}));

router.post('/', asyncRoute<AuthRequest>(async (req, res) => {
  const body = bodyRecord(req.body);
  const template = await db.maTemplate.create({
    data: { userId: req.userId!, name: parseName(body['name']), averages: json(parseAverages(body['averages'] ?? [])) },
  });
  notify(req.userId!);
  res.status(201).json({ id: template.id, name: template.name, isDefault: template.isDefault, averages: template.averages });
}));

router.put('/assignments', asyncRoute<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const body = bodyRecord(req.body);
  const broker = nonEmptyString(body['broker'], 'broker');
  const tf = body['timeframe'] == null ? '' : oneOf(body['timeframe'], 'timeframe', TIMEFRAMES);
  const raw = body['templateId'];
  if (raw === null) {
    await db.maTemplateBroker.deleteMany({ where: { userId, broker, timeframe: tf } });
  } else {
    const id = integer(raw, 'templateId', { min: 1 });
    await ownTemplate(userId, id);
    await db.maTemplateBroker.upsert({
      where: { userId_broker_timeframe: { userId, broker, timeframe: tf } },
      create: { userId, broker, timeframe: tf, templateId: id },
      update: { templateId: id },
    });
  }
  notify(userId);
  res.json({ broker, timeframe: tf || null, templateId: raw === null ? null : raw });
}));

router.put('/:id', asyncRoute<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const id = templateId(req.params['id']);
  await ownTemplate(userId, id);
  const body = bodyRecord(req.body);
  const data: Prisma.MaTemplateUpdateInput = {};
  if (body['name'] !== undefined) data.name = parseName(body['name']);
  if (body['averages'] !== undefined) data.averages = json(parseAverages(body['averages']));
  if (Object.keys(data).length === 0) throw new BadRequest('name or averages is required');
  const template = await db.maTemplate.update({ where: { id }, data });
  notify(userId);
  res.json({ id: template.id, name: template.name, isDefault: template.isDefault, averages: template.averages });
}));

router.put('/:id/default', asyncRoute<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const id = templateId(req.params['id']);
  await ownTemplate(userId, id);
  await db.$transaction([
    db.maTemplate.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } }),
    db.maTemplate.update({ where: { id }, data: { isDefault: true } }),
  ]);
  notify(userId);
  res.json({ id, isDefault: true });
}));

router.delete('/:id', asyncRoute<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const id = templateId(req.params['id']);
  const template = await ownTemplate(userId, id);
  if (template.isDefault) throw new Conflict('The default template cannot be deleted');
  await db.maTemplate.delete({ where: { id } });
  notify(userId);
  res.status(204).end();
}));

export default router;
