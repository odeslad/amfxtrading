import { Router } from 'express';
import { db } from '../db/client';
import { asyncRoute } from '../middleware/asyncRoute';
import { singleQuery } from '../middleware/parse';

const router = Router();

router.get('/', asyncRoute(async (req, res) => {
  const broker = singleQuery(req.query, 'broker');

  // groupBy runs DISTINCT in SQL; findMany+distinct would load every candle row into memory.
  const rows = await db.candle.groupBy({ by: ['symbol'], where: broker ? { broker } : {} });
  res.json(rows.map((r) => r.symbol).sort());
}));

export default router;
