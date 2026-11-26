import { expandAllToGroups } from '../../lib/entryGroups';
import { getEntryGroups } from '../../lib/useEntryGroups';
import { getLivePositions } from './useLivePositions';
import type { Position } from './utils/position';

// Spec 062: an action on an entry reaches every open member of its mirror group, the entry first.
// `open` defaults to the Journal live feed; the chart passes its own rows.
export function expandWithGroups(entries: Position[], open: Position[] = getLivePositions()): Position[] {
  return expandAllToGroups(getEntryGroups(), entries, open);
}
