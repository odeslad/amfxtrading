import { memo } from 'react';
import type { MaTemplate } from '../../lib/useMaTemplates';
import { maLabel } from './movingAverages';
import styles from './IndicatorsPanel.module.css';

interface IndicatorsPanelProps {
  open: boolean;
  onClose: () => void;
  template: MaTemplate | null;
  hidden: string[];
  onToggleHidden: (id: string) => void;
}

// The chart's indicators button (spec 052): the moving averages of the broker's template,
// each shown or hidden on this device.
export const IndicatorsPanel = memo(function IndicatorsPanel({ open, onClose, template, hidden, onToggleHidden }: IndicatorsPanelProps) {
  const averages = template?.averages ?? [];
  return (
    <>
      {open && <div className={styles.backdrop} onClick={onClose} />}
      <div className={`${styles.panel} ${open ? styles.panelOpen : ''}`}>
        <div className={styles.header}>
          <span className={styles.title}>Indicators</span>
          <button type="button" className={styles.closeBtn} aria-label="Close" onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          <div>
            <div className={styles.sectionTitle}>{template ? template.name : 'Moving averages'}</div>
            {averages.length === 0 && <p className={styles.empty}>This template has no moving averages.</p>}
            <div className={styles.emaList}>
              {averages.map(a => {
                const visible = !hidden.includes(a.id);
                return (
                  <label key={a.id} className={`${styles.maRow} ${visible ? '' : styles.maRowHidden}`}>
                    <span className={styles.maName}>
                      <span
                        className={styles.maLine}
                        style={{ borderTopColor: visible ? a.color : 'var(--muted)', borderTopStyle: a.style, borderTopWidth: Math.max(2, a.width) }}
                      />
                      {maLabel(a)}{visible ? '' : ' · hidden'}
                    </span>
                    <input type="checkbox" checked={visible} onChange={() => onToggleHidden(a.id)} aria-label={`Show ${maLabel(a)}`} />
                  </label>
                );
              })}
            </div>
            <p className={styles.note}>Hidden averages stay hidden on this device only.</p>
          </div>
        </div>
      </div>
    </>
  );
});
