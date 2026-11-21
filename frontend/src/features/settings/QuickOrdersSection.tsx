import { DEFAULT_QUICK_ORDERS, quickOrdersError, type QuickLotsMode, type QuickOrders, type QuickTpMode } from '../../lib/quickOrders';
import { Button, Field, Hint, Section, Segmented, Select, TextInput, type SegmentOption } from '../../shared/ui';
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

const LOTS_MODES: SegmentOption<QuickLotsMode>[] = [{ value: 'fixed', label: 'Lots' }, { value: 'risk_pct', label: 'Risk %' }];
const TP_MODES: SegmentOption<QuickTpMode>[] = [{ value: 'pips', label: 'Pips' }, { value: 'r', label: 'R' }];

export function QuickOrdersSection({ value, presets, onChange }: QuickOrdersSectionProps) {
  const savedPresets = presets.filter((p): p is MirrorPreset & { id: number } => p.id !== undefined);
  const error = quickOrdersError(value);
  const sizeFromPreset = value?.mirrorPresetId != null;

  const patch = (next: Partial<QuickOrders>) => value && onChange({ ...value, ...next });

  return (
    <Section
      title="Quick market / orders"
      description="Chart menu: Quick buy / sell at market opens a position; at the clicked price it places a pending order. Each one asks for confirmation."
      accent="orange"
      actions={value
        ? <Button size="sm" onClick={() => onChange(null)}>Clear</Button>
        : <Button variant="primary" size="sm" onClick={() => onChange(DEFAULT_QUICK_ORDERS)}>Set up</Button>}
    >
      {value && (
        <div className={styles.body}>
          <div className={styles.grid}>
            <Field label={sizeFromPreset ? 'Size · from the preset' : 'Size'}>
              <div className={styles.inline}>
                <Segmented
                  label="Size mode"
                  options={LOTS_MODES}
                  value={value.lotsMode}
                  disabled={sizeFromPreset}
                  onChange={lotsMode => patch({ lotsMode })}
                />
                <TextInput
                  inputMode="decimal" aria-label="Size" disabled={sizeFromPreset}
                  defaultValue={value.size} key={`size-${value.lotsMode}`}
                  onChange={e => patch({ size: numberOrNull(e.target.value) ?? 0 })}
                />
              </div>
            </Field>

            <Field label="Stop loss · pips (optional)">
              <TextInput
                inputMode="decimal" aria-label="Stop loss in pips" placeholder="none"
                defaultValue={value.slPips ?? ''}
                onChange={e => patch({ slPips: numberOrNull(e.target.value) })}
              />
            </Field>

            <Field label="Take profit (optional)">
              <div className={styles.inline}>
                <Segmented
                  label="Take profit mode"
                  options={TP_MODES}
                  value={value.tpMode}
                  onChange={tpMode => patch(value.tpMode === tpMode ? { tpMode: null, tp: null } : { tpMode })}
                />
                <TextInput
                  inputMode="decimal" aria-label="Take profit" placeholder="none"
                  disabled={value.tpMode === null} defaultValue={value.tp ?? ''} key={`tp-${value.tpMode ?? 'none'}`}
                  onChange={e => patch({ tp: numberOrNull(e.target.value) })}
                />
              </div>
            </Field>

            <Field label="Mirror preset (optional)" htmlFor="quick-mirror-preset">
              <Select
                id="quick-mirror-preset"
                value={value.mirrorPresetId ?? ''}
                onChange={e => patch({ mirrorPresetId: e.target.value === '' ? null : Number(e.target.value) })}
              >
                <option value="">None · the chart's broker</option>
                {savedPresets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
          </div>
          <Hint tone={error ? 'error' : 'muted'}>
            {error ?? 'Risk % and a take profit in R need a stop loss. With a preset, each enabled broker uses its own size from the preset.'}
          </Hint>
        </div>
      )}
    </Section>
  );
}
