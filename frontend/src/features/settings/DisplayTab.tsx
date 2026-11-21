import { SETUP_LEVEL_KEYS, type PnlMode, type SetupLevelKey } from '../journal/utils/position';
import { FIB_LEVEL_ANCHORS, FIB_LEVEL_CATALOGUE, type TrendlineStyle } from '../chart/DrawingTools';
import { EMA_TRADES_LABEL_KEYS, EMA_TRADES_LABEL_NAMES, EMA_TRADES_LIMITS, type EmaTradesLabel, type EmaTradesNumberKey, type EmaTradesSettings } from '../chart/emaTrades';
import type { MaType } from '../chart/chart.types';
import { Card, ColorPicker, Hint, NumberInput, Row, Section, Segmented, Select, Toggle, type SegmentOption } from '../../shared/ui';
import { MaTemplatesSection } from './MaTemplatesSection';
import type { QuickOrders } from '../../lib/quickOrders';
import styles from './DisplayTab.module.css';

export interface DisplaySettingsForm {
  pnlMode: PnlMode;
  trendlineColor: string;
  trendlineStyle: TrendlineStyle;
  trendlineWidth: number;
  rectLabels: boolean;
  showSpread: boolean;
  setupLevels: SetupLevelKey[];
  fibLevels: number[];
  emaTrades: EmaTradesSettings;
  quickOrders: QuickOrders | null;
}

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

const TRENDLINE_COLORS = ['#8c8c8c', '#f5a623', '#3a7bd5', '#4caf84', '#e05c5c', '#c8a840'];
const TRENDLINE_WIDTHS = [1, 2, 3];

const MA_TYPE_OPTIONS: SegmentOption<MaType>[] = [{ value: 'ema', label: 'EMA' }, { value: 'sma', label: 'SMA' }];

const LEVEL_MEANING: Record<SetupLevelKey, string> = {
  ECC: 'Cross candle close',
  EMA: 'EMA cross price',
  EVL: 'Fast EMA extreme',
  MHL: 'Window high / low',
};

interface DisplayTabProps {
  display: DisplaySettingsForm;
  onChange: (patch: Partial<DisplaySettingsForm>) => void;
}

export function DisplayTab({ display, onChange }: DisplayTabProps) {
  const toggleLevel = (key: SetupLevelKey, on: boolean) => {
    const next = SETUP_LEVEL_KEYS.filter(k => (k === key ? on : display.setupLevels.includes(k)));
    onChange({ setupLevels: next });
  };

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

  const toggleFibLevel = (level: number, on: boolean) => {
    const next = FIB_LEVEL_CATALOGUE.filter(l => FIB_LEVEL_ANCHORS.includes(l) || (l === level ? on : display.fibLevels.includes(l)));
    onChange({ fibLevels: next });
  };

  return (
    <div className={styles.tab}>
      <Hint>How data is shown across the app.</Hint>

      <Section title="General">
        <Row label="P&L Mode" htmlFor="display-pnl">
          <Select id="display-pnl" size="sm" value={display.pnlMode} onChange={e => onChange({ pnlMode: e.target.value as PnlMode })}>
            <option value="net">Net (profit + swap + commission)</option>
            <option value="gross">Gross (profit only)</option>
            <option value="pips">Pips</option>
            <option value="pct">% Net (over account balance)</option>
          </Select>
        </Row>
      </Section>

      <Section title="Drawings">
        <Row label="Trendline style" htmlFor="display-trend-style">
          <Select id="display-trend-style" size="sm" value={display.trendlineStyle} onChange={e => onChange({ trendlineStyle: e.target.value as TrendlineStyle })}>
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </Select>
        </Row>
        <Row label="Trendline width" htmlFor="display-trend-width">
          <Select id="display-trend-width" size="sm" value={display.trendlineWidth} onChange={e => onChange({ trendlineWidth: Number(e.target.value) })}>
            {TRENDLINE_WIDTHS.map(w => <option key={w} value={w}>{w}px</option>)}
          </Select>
        </Row>
        <Row label="Trendline color" inline>
          <ColorPicker value={display.trendlineColor} palette={TRENDLINE_COLORS} onChange={trendlineColor => onChange({ trendlineColor })} label="Trendline color" />
        </Row>
        <Row label="Rectangle labels (prices and pips)" inline>
          <Toggle checked={display.rectLabels} onChange={rectLabels => onChange({ rectLabels })} label="Rectangle labels" />
        </Row>
        <div className={styles.group}>
          <Row label="Fibonacci levels" hint="Levels drawn by the Fibonacci tool on every chart. 0 and 100 are the anchors and stay on." inline>
            {null}
          </Row>
          <div className={`${styles.cardGrid} ${styles.fibGrid}`}>
            {FIB_LEVEL_CATALOGUE.map(level => {
              const anchor = FIB_LEVEL_ANCHORS.includes(level);
              return (
                <Card
                  key={level}
                  title={`${level} %`}
                  actions={
                    <Toggle
                      checked={anchor || display.fibLevels.includes(level)}
                      disabled={anchor}
                      onChange={on => toggleFibLevel(level, on)}
                      label={`Fibonacci level ${level} %`}
                    />
                  }
                />
              );
            })}
          </div>
        </div>
      </Section>

      <Section title="EMA cross trades" description="Drawn on the chart by the toolbar button: the last crosses of these averages, each with its entry and its SL.">
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

      <Section title="Price">
        <Row label="Spread (ASK and BID lines)" hint="Replaces the current-price line on the chart" inline>
          <Toggle checked={display.showSpread} onChange={showSpread => onChange({ showSpread })} label="Spread" />
        </Row>
      </Section>

      <Section title="Setup levels" description="Levels listed in the New Trade panel. All off hides the panel.">
        <div className={`${styles.cardGrid} ${styles.groupBody}`}>
          {SETUP_LEVEL_KEYS.map(key => (
            <Card
              key={key}
              title={key}
              meta={LEVEL_MEANING[key]}
              actions={<Toggle checked={display.setupLevels.includes(key)} onChange={on => toggleLevel(key, on)} label={key} />}
            />
          ))}
        </div>
      </Section>

      <MaTemplatesSection />
    </div>
  );
}
