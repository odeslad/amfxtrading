import { Router } from 'express';
import { currentSystemStatus } from '../store/system-status';

const router = Router();

// Same object the WebSocket pushes as `system`, for the first paint (spec 045).
router.get('/', (_req, res) => {
  res.json(currentSystemStatus());
});

export default router;
