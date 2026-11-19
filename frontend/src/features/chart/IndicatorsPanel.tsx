import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { MaTemplate } from '../../lib/useMaTemplates';
import { maLabel } from './movingAverages';
import styles from './IndicatorsPanel.module.css';

interface IndicatorsPanelProps {
  open: boolean;
  onClose: () => void;
  broker: string;
  templates: MaTemplate[];
  assignedId: number | null;
  template: MaTemplate | null;
  hidden: string[];
  onToggleHidden: (id: string) => void;
  onAssign: (broker: string, templateId: number | null) => Promise<void>;
}

const DEFAULT_OPTION = 'default';

// The chart's indicators button (spec 052): the template of the chart's broker, which
// applies to every chart of that broker, and its averages shown or hidden on this device.
export const IndicatorsPanel = memo(function IndicatorsPanel({
  open, onClose, broker, templates, assignedId, template, hidden, onToggleHidden, onAssign,
}: IndicatorsPanelProps) {
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const averages = template?.averages ?? [];
  const defaultName = templates.find(t => t.isDefault)?.name ?? 'Default';

  const choose = async (value: string) => {
    setSaving(true);
    setFailed(false);
    try {
      await onAssign(broker, value === DEFAULT_OPTION ? null : Number(value));
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {open && <div className={styles.backdrop} onClick={onClose} />}
      <div className={`${styles.panel} ${open ? styles.panelOpen : ''}`}>
        <div className={styles.header}>
          <span className={styles.title}>Indicators</span>
          <button type="button" className={styles.closeBtn} aria-label="Close" onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.field}>
            <label htmlFor="ma-template-for" className={styles.sectionTitle}>Template for {broker || '—'}</label>
            <select
              id="ma-template-for"
              className={styles.select}
              value={assignedId === null ? DEFAULT_OPTION : String(assignedId)}
              disabled={!broker || saving}
              onChange={e => void choose(e.target.value)}
            >
              <option value={DEFAULT_OPTION}>Default (★ {defaultName})</option>
              {templates.filter(t => !t.isDefault).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <p className={styles.note}>{failed ? 'Could not change the template.' : `Applies to every chart of ${broker || 'this broker'}.`}</p>
          </div>

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

          <Link to="/settings?tab=display" className={styles.link} onClick={onClose}>Edit in Settings › Display →</Link>
        </div>
      </div>
    </>
  );
});
