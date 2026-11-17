import { useEffect, useState } from 'react';
import type { SystemStatusView } from '../../lib/useSystemStatus';
import { SystemStatusPanel } from './SystemStatusPanel';
import { LEVEL_CLASS } from './systemStatusLevel';
import { LEVEL_LABEL } from './systemStatusText';
import styles from './SystemStatus.module.css';

interface SystemStatusMobileProps {
  view: SystemStatusView;
}

export function SystemStatusMobile({ view }: SystemStatusMobileProps) {
  const [open, setOpen] = useState(false);
  const tone = view.level ? LEVEL_CLASS[view.level] : '';

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  return (
    <div className={styles.mobileOnly}>
      <button
        type="button"
        className={`${styles.light} ${styles.lightMobile} ${view.level && view.level !== 'ok' ? tone : ''}`}
        aria-label={`System status: ${view.level ? LEVEL_LABEL[view.level] : 'unknown'}`}
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
      >
        <span className={`${styles.dot} ${tone}`} />
        <span>System</span>
      </button>

      {open && (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} />
          <div role="dialog" aria-label="System status" className={`${styles.sheet} ${tone}`}>
            <button type="button" className={styles.close} aria-label="Close" onClick={() => setOpen(false)}>✕</button>
            <SystemStatusPanel view={view} />
          </div>
        </>
      )}
    </div>
  );
}
