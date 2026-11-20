import { DEFAULT_QUICK_ORDERS, quickOrdersError, type QuickLotsMode, type QuickOrders, type QuickTpMode } from '../../lib/quickOrders';
import type { MirrorPreset } from './MirrorTab';
import styles from './QuickOrdersSection.module.css';

interface QuickOrdersSectionProps {
  value: QuickOrders | null;
  presets: MirrorPreset[];
  onChange: (value: QuickOrders | null) => void;
}

const numberOrNull = (raw: string): number | null => {
  const value = parseFloat(raw.replace(',', '.'));
  return raw.trim() === '' || !Number.isFinite(value) ? null : value;
};

const LOTS_MODES: Array<{ key: QuickLotsMode; label: string }> = [{ key: 'fixed', label: 'Lots' }, { key: 'risk_pct', label: 'Risk %' }];
const TP_MODES: Array<{ key: QuickTpMode; label: string }> = [{ key: 'pips', label: 'Pips' }, { key: 'r', label: 'R' }];

export function QuickOrdersSection({ value, presets, onChange }: QuickOrdersSectionProps) {
  const savedPresets = presets.filter((p): p is MirrorPreset & { id: number } => p.id !== undefined);
  const error = quickOrdersError(value);
  const sizeFromPreset = value?.mirrorPresetId != null;

  const patch = (next: Partial<QuickOrders>) => value && onChange({ ...value, ...next });

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Quick market / orders</h3>
          <p className={styles.hint}>Chart menu: Quick buy / sell at market opens a position; at the clicked price it places a pending order. Each one asks for confirmation.</p>
        </div>
        {value
          ? <button type="button" className={styles.clearBtn} onClick={() => onChange(null)}>Clear</button>
          : <button type="button" className={styles.setupBtn} onClick={() => onChange(DEFAULT_QUICK_ORDERS)}>Set up</button>}
      </div>

      {value && (
        <>
          <div className={styles.grid}>
            <div className={styles.field}>
              <span className={styles.label}>{sizeFromPreset ? 'Size · from the preset' : 'Size'}</span>
              <div className={styles.inline}>
                <div className={`${styles.seg} ${sizeFromPreset ? styles.segDisabled : ''}`} role="group" aria-label="Size mode">
                  {LOTS_MODES.map(m => (
                    <button key={m.key} type="button" className={value.lotsMode === m.key ? styles.segOn : styles.segBtn} aria-pressed={value.lotsMode === m.key} disabled={sizeFromPreset} onClick={() => patch({ lotsMode: m.key })}>{m.label}</button>
                  ))}
                </div>
                <input
                  type="text" inputMode="decimal" className={styles.input} aria-label="Size" disabled={sizeFromPreset}
                  defaultValue={value.size} key={`size-${value.lotsMode}`}
                  onChange={e => patch({ size: numberOrNull(e.target.value) ?? 0 })}
                />
              </div>
            </div>

            <div className={styles.field}>
              <span className={styles.label}>Stop loss · pips (optional)</span>
              <input
                type="text" inputMode="decimal" className={styles.input} aria-label="Stop loss in pips" placeholder="none"
                defaultValue={value.slPips ?? ''}
                onChange={e => patch({ slPips: numberOrNull(e.target.value) })}
              />
            </div>

            <div className={styles.field}>
              <span className={styles.label}>Take profit (optional)</span>
              <div className={styles.inline}>
                <div className={styles.seg} role="group" aria-label="Take profit mode">
                  {TP_MODES.map(m => (
                    <button key={m.key} type="button" className={value.tpMode === m.key ? styles.segOn : styles.segBtn} aria-pressed={value.tpMode === m.key}
                      onClick={() => patch(value.tpMode === m.key ? { tpMode: null, tp: null } : { tpMode: m.key })}>{m.label}</button>
                  ))}
                </div>
                <input
                  type="text" inputMode="decimal" className={styles.input} aria-label="Take profit" placeholder="none"
                  disabled={value.tpMode === null} defaultValue={value.tp ?? ''} key={`tp-${value.tpMode ?? 'none'}`}
                  onChange={e => patch({ tp: numberOrNull(e.target.value) })}
                />
              </div>
            </div>

            <div className={styles.field}>
              <span className={styles.label}>Mirror preset (optional)</span>
              <select
                className={styles.select} aria-label="Mirror preset"
                value={value.mirrorPresetId ?? ''}
                onChange={e => patch({ mirrorPresetId: e.target.value === '' ? null : Number(e.target.value) })}
              >
                <option value="">None · the chart's broker</option>
                {savedPresets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <p className={error ? styles.error : styles.hint}>
            {error ?? 'Risk % and a take profit in R need a stop loss. With a preset, each enabled broker uses its own size from the preset.'}
          </p>
        </>
      )}
    </section>
  );
}
