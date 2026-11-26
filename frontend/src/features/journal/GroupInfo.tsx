import { useState } from 'react';
import { Button, GroupStar, Hint } from '../../shared/ui';
import { activeGroupOf } from '../../lib/entryGroups';
import { takeOutOfGroup, useEntryGroups } from '../../lib/useEntryGroups';
import { errorMessage } from '../../lib/api';
import { addToast } from '../../lib/toast';
import type { Position } from './utils/position';
import styles from './GroupInfo.module.css';

interface GroupInfoProps {
  entries: Position[];
  onTakenOut: () => void;
}

// Spec 062: shown when an edit panel holds a whole mirror group; the first entry is the one opened.
export function GroupInfo({ entries, onTakenOut }: GroupInfoProps) {
  const groups = useEntryGroups();
  const [busy, setBusy] = useState(false);
  const first = entries[0];
  const active = first ? activeGroupOf(groups, first, entries) : null;
  if (!first || !active || active.members.length !== entries.length) return null;

  const brokers = entries.map(p => p.broker).join(', ');

  const handleTakeOut = async () => {
    setBusy(true);
    try {
      await takeOutOfGroup(first.broker ?? '', first.ticket);
      addToast(`${first.broker} #${first.ticket} taken out of its group`, 'info');
      onTakenOut();
    } catch (err) {
      addToast(errorMessage(err, 'Failed to take the entry out of its group'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.box}>
      <Hint tone="warning" boxed>
        <span className={styles.line}>
          <GroupStar color={active.group.color} />
          Applies to the {entries.length} entries of the group: {brokers}
        </span>
      </Hint>
      <Button variant="dashed" size="sm" onClick={handleTakeOut} disabled={busy}>
        Take {first.broker} out of group
      </Button>
    </div>
  );
}
