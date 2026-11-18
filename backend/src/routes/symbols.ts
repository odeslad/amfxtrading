import { Router } from 'express';
import { storedSymbols } from '../services/candle-store';
import { asyncRoute } from '../middleware/asyncRoute';
import { singleQuery } from '../middleware/parse';

const router = Router();

router.get('/', asyncRoute(async (req, res) => {
  const broker = singleQuery(req.query, 'broker');

  res.json(await storedSymbols(broker));
}));

export default router;
