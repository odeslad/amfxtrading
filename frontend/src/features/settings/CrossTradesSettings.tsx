import { EMA_TRADES_LABEL_KEYS, EMA_TRADES_LABEL_NAMES, EMA_TRADES_LIMITS, type EmaTradesLabel, type EmaTradesNumberKey } from '../chart/emaTrades';
import type { MaType } from '../chart/chart.types';
import { Card, NumberInput, Row, Section, Segmented, Toggle, type SegmentOption } from '../../shared/ui';
import type { DisplaySettingsProps } from './displaySettings';
import styles from './DisplayTab.module.css';

interface EmaTradesField {
  key: EmaTradesNumberKey;
  typeKey?: 'fastType' | 'slowType';
  label: string;
  hint?: string;
  min: number;
  max?: number;
  step: number;
}

const EMA_TRADES_FIELDS: EmaTradesField[] = [
  { key: 'fast', typeKey: 'fastType', label: 'Fast average', min: 1, step: 1 },
  { key: 'slow', typeKey: 'slowType', label: 'Slow average', min: 1, step: 1 },
  { key: 'entryPips', label: 'Entry offset (pips)', hint: 'Above the cross-candle close for a buy, below it for a sell', min: 0, step: 0.1 },
  { key: 'candles', label: 'Max duration (candles)', hint: 'Candles of the chart timeframe; lines end here or at the next opposite cross, whichever comes first', min: EMA_TRADES_LIMITS.candles.min, max: EMA_TRADES_LIMITS.candles.max, step: 1 },
  { key: 'count', label: 'Trades shown', hint: 'Most recent crosses, both directions', min: EMA_TRADES_LIMITS.count.min, max: EMA_TRADES_LIMITS.count.max, step: 1 },
  { key: 'tpRatio', label: 'Take profit (R:R)', hint: 'Reward over the entry-SL distance; 2 means the TP sits at twice the risk', min: EMA_TRADES_LIMITS.tpRatio.min, max: EMA_TRADES_LIMITS.tpRatio.max, step: 0.1 },
];

const MA_TYPE_OPTIONS: SegmentOption<MaType>[] = [{ value: 'ema', label: 'EMA' }, { value: 'sma', label: 'SMA' }];

// Settings › Indicators › Cross trades: the overlay drawn by the chart's toolbar button.
export function CrossTradesSettings({ display, onChange }: DisplaySettingsProps) {
  const updateEmaTrades = (key: EmaTradesNumberKey, raw: string) => {
    const value = Number(raw);
    if (raw === '' || !Number.isFinite(value)) return;
    onChange({ emaTrades: { ...display.emaTrades, [key]: value } });
  };

  const updateEmaTradesType = (key: 'fastType' | 'slowType') => (value: MaType) =>
    onChange({ emaTrades: { ...display.emaTrades, [key]: value } });

  // At least one part stays on so an SL / TP label is never blank.
  const toggleEmaTradesLabel = (key: EmaTradesLabel, on: boolean) => {
    const next = EMA_TRADES_LABEL_KEYS.filter(k => (k === key ? on : display.emaTrades.labels.includes(k)));
    if (next.length === 0) return;
    onChange({ emaTrades: { ...display.emaTrades, labels: next } });
  };

  return (
    <Section title="Cross trades" description="Drawn on the chart by the toolbar button: the last crosses of these averages, each with its entry and its SL.">
      <div className={styles.fieldGrid}>
        {EMA_TRADES_FIELDS.map(field => (
          <Row key={field.key} label={field.label} hint={field.hint} htmlFor={`ema-trades-${field.key}`}>
            {field.typeKey && (
              <Segmented
                size="sm"
                label={`${field.label} type`}
                options={MA_TYPE_OPTIONS}
                value={display.emaTrades[field.typeKey]}
                onChange={updateEmaTradesType(field.typeKey)}
              />
            )}
            <NumberInput
              id={`ema-trades-${field.key}`}
              size="sm"
              className={styles.number}
              value={display.emaTrades[field.key]}
              min={field.min}
              max={field.max}
              step={field.step}
              onChange={e => updateEmaTrades(field.key, e.target.value)}
            />
          </Row>
        ))}
      </div>
      <div className={styles.group}>
        <Row label="SL / TP labels" hint="What the stop and take profit tags show on the chart; at least one stays on" inline>
          {null}
        </Row>
        <div className={styles.cardGrid}>
          {EMA_TRADES_LABEL_KEYS.map(key => (
            <Card
              key={key}
              title={EMA_TRADES_LABEL_NAMES[key]}
              actions={
                <Toggle
                  checked={display.emaTrades.labels.includes(key)}
                  onChange={on => toggleEmaTradesLabel(key, on)}
                  label={`EMA trades label ${EMA_TRADES_LABEL_NAMES[key]}`}
                />
              }
            />
          ))}
        </div>
      </div>
    </Section>
  );
}
