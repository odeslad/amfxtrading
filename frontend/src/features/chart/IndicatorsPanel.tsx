import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { MaAssignment, MaSource, MaTemplate } from '../../lib/useMaTemplates';
import { maLabel } from './movingAverages';
import styles from './IndicatorsPanel.module.css';

interface IndicatorsPanelProps {
  open: boolean;
  onClose: () => void;
  broker: string;
  timeframe: string;
  templates: MaTemplate[];
  template: MaTemplate | null;
  source: MaSource;
  assignmentOf: (broker: string, timeframe: string | null) => MaAssignment | undefined;
  hidden: string[];
  onToggleHidden: (id: string) => void;
  onAssign: (broker: string, timeframe: string | null, templateId: number | null) => Promise<void>;
}

const NONE = 'none';

// The chart's indicators button (spec 052): the template of the chart's broker — on every
// timeframe or only on this one — and its averages shown or hidden on this device.
export const IndicatorsPanel = memo(function IndicatorsPanel({
  open, onClose, broker, timeframe, templates, template, source, assignmentOf, hidden, onToggleHidden, onAssign,
}: IndicatorsPanelProps) {
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const averages = template?.averages ?? [];
  const defaultTemplate = templates.find(t => t.isDefault);
  const onlyTf = source === 'timeframe';
  const assigned = assignmentOf(broker, onlyTf ? timeframe : null)?.templateId;
  const brokerTemplate = templates.find(t => t.id === assignmentOf(broker, null)?.templateId) ?? defaultTemplate;

  const write = async (tf: string | null, templateId: number | null) => {
    setSaving(true);
    setFailed(false);
    try {
      await onAssign(broker, tf, templateId);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const choose = (value: string) => write(onlyTf ? timeframe : null, value === NONE ? null : Number(value));
  // Ticking keeps the template on screen, now only for this timeframe; unticking returns
  // the timeframe to the broker's template.
  const toggleOnlyTf = (checked: boolean) =>
    checked ? write(timeframe, template?.id ?? defaultTemplate?.id ?? null) : write(timeframe, null);

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
            <label htmlFor="ma-template-for" className={styles.sectionTitle}>Template for {broker || '—'}{onlyTf ? ` · ${timeframe}` : ''}</label>
            <select
              id="ma-template-for"
              className={styles.select}
              value={assigned ?? NONE}
              disabled={!broker || saving}
              onChange={e => void choose(e.target.value)}
            >
              <option value={NONE}>{onlyTf ? `Same as ${broker} (${brokerTemplate?.name ?? 'Default'})` : `Default (★ ${defaultTemplate?.name ?? 'Default'})`}</option>
              {templates.filter(t => onlyTf || !t.isDefault).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <label className={styles.onlyTf}>
              <input type="checkbox" checked={onlyTf} disabled={!broker || saving} onChange={e => void toggleOnlyTf(e.target.checked)} />
              Only on {timeframe}
            </label>
            {failed && <p className={styles.error}>Could not change the template.</p>}
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

          <Link to="/settings?section=indicators" className={styles.link} onClick={onClose}>Edit in Settings › Indicators →</Link>
        </div>
      </div>
    </>
  );
});
