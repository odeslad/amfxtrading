import { useId, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useSystemStatus } from '../../lib/useSystemStatus';
import { SystemStatusPanel } from './SystemStatusPanel';
import { LEVEL_CLASS } from './systemStatusLevel';
import { LEVEL_LABEL } from './systemStatusText';
import styles from './SystemStatus.module.css';

export function SystemStatus() {
  const view = useSystemStatus();
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const tone = view.level ? LEVEL_CLASS[view.level] : '';

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') setOpen(false);
  };

  return (
    <div
      className={styles.anchor}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className={`${styles.light} ${view.level && view.level !== 'ok' ? tone : ''}`}
        aria-label={`System status: ${view.level ? LEVEL_LABEL[view.level] : 'unknown'}`}
        aria-describedby={open ? tooltipId : undefined}
      >
        <span className={`${styles.dot} ${tone}`} />
        <span>System</span>
      </button>

      {open && (
        <div id={tooltipId} role="tooltip" className={`${styles.tooltip} ${tone}`}>
          <SystemStatusPanel view={view} />
        </div>
      )}
    </div>
  );
}
