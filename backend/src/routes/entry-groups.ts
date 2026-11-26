import { Router } from 'express';
import { entryGroups, type GroupMember } from '../store/entry-groups';
import { bodyRecord, nonEmptyString, integer } from '../middleware/parse';

export function parseMember(raw: unknown): GroupMember {
  const body = bodyRecord(raw);
  return { broker: nonEmptyString(body.broker, 'broker'), ticket: integer(body.ticket, 'ticket') };
}

const router = Router();

router.get('/', (_req, res) => {
  res.json(entryGroups.getGroups());
});

// Spec 062: takes one entry out of its group; later changes no longer reach it.
router.delete('/members', (req, res) => {
  const { broker, ticket } = parseMember(req.body);
  if (!entryGroups.removeMember(broker, ticket)) {
    res.status(404).json({ error: 'Entry is not in a group' });
    return;
  }
  res.json({ ok: true });
});

export default router;
