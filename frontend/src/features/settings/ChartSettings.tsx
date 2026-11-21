import type { PnlMode } from '../journal/utils/position';
import { FIB_LEVEL_ANCHORS, FIB_LEVEL_CATALOGUE, type TrendlineStyle } from '../chart/DrawingTools';
import { Card, ColorPicker, Row, Section, Select, Toggle } from '../../shared/ui';
import type { DisplaySettingsProps } from './displaySettings';
import styles from './displaySettings.module.css';

const TRENDLINE_COLORS = ['#8c8c8c', '#f5a623', '#3a7bd5', '#4caf84', '#e05c5c', '#c8a840'];
const TRENDLINE_WIDTHS = [1, 2, 3];

// Settings › Chart: P&L, drawings and price lines.
export function ChartSettings({ display, onChange }: DisplaySettingsProps) {
  const toggleFibLevel = (level: number, on: boolean) => {
    const next = FIB_LEVEL_CATALOGUE.filter(l => FIB_LEVEL_ANCHORS.includes(l) || (l === level ? on : display.fibLevels.includes(l)));
    onChange({ fibLevels: next });
  };

  return (
    <>
      <Section title="P&L" description="How open positions show their result on the chart and in the journal.">
        <Row label="P&L Mode" htmlFor="display-pnl">
          <Select id="display-pnl" size="sm" value={display.pnlMode} onChange={e => onChange({ pnlMode: e.target.value as PnlMode })}>
            <option value="net">Net (profit + swap + commission)</option>
            <option value="gross">Gross (profit only)</option>
            <option value="pips">Pips</option>
            <option value="pct">% Net (over account balance)</option>
          </Select>
        </Row>
      </Section>

      <Section title="Drawings" description="Default style and colours of the lines you draw on the chart.">
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

      <Section title="Price" description="Price lines and labels drawn on the chart.">
        <Row label="Spread (ASK and BID lines)" hint="Replaces the current-price line on the chart" inline>
          <Toggle checked={display.showSpread} onChange={showSpread => onChange({ showSpread })} label="Spread" />
        </Row>
      </Section>
    </>
  );
}
