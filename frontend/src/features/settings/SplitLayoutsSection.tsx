import { Button, Card, EmptyState, Field, Section, Select, Table, TextInput, type TableColumn } from '../../shared/ui';
import { LAYOUT_TIMEFRAMES, type LayoutSide, type SplitLayout } from '../../lib/useSplitLayouts';
import styles from './SplitLayoutsSection.module.css';

export interface SplitLayoutForm extends SplitLayout {
  key: string;
}

type SideName = 'left' | 'right';

interface SideRow {
  side: SideName;
  label: string;
  value: LayoutSide;
}

interface SplitLayoutsSectionProps {
  layouts: SplitLayoutForm[];
  selectedKey: string | null;
  brokers: string[];
  pairsOf: (broker: string) => string[];
  onSelect: (key: string) => void;
  onAdd: () => void;
  onDelete: () => void;
  onChange: (key: string, patch: Partial<SplitLayout>) => void;
}

const DESCRIPTION = 'Broker, pair and timeframe of each chart, applied from the split layouts button on the chart. Same broker and pair on both sides: the charts are applied linked.';

export function SplitLayoutsSection({ layouts, selectedKey, brokers, pairsOf, onSelect, onAdd, onDelete, onChange }: SplitLayoutsSectionProps) {
  const selected = layouts.find(l => l.key === selectedKey) ?? layouts[0];

  if (!selected) {
    return (
      <Section title="Split layouts" description={DESCRIPTION}>
        <div className={styles.body}>
          <EmptyState>No split layouts yet.</EmptyState>
          <div><Button variant="buyOutline" onClick={onAdd} disabled={brokers.length === 0}>+ New</Button></div>
        </div>
      </Section>
    );
  }

  const setSide = (side: SideName, patch: Partial<LayoutSide>) => {
    const next = { ...selected[side], ...patch };
    // A broker without the pair falls back to its first active pair.
    if (patch.broker !== undefined) {
      const pairs = pairsOf(patch.broker);
      if (!pairs.includes(next.symbol)) next.symbol = pairs.includes('EURUSD') ? 'EURUSD' : pairs[0] ?? next.symbol;
    }
    onChange(selected.key, { [side]: next });
  };

  const pairOptions = (value: LayoutSide) => {
    const pairs = pairsOf(value.broker);
    return pairs.includes(value.symbol) ? pairs : [value.symbol, ...pairs];
  };

  const brokerSelect = (r: SideRow) => (
    <Select aria-label={`${r.label} broker`} value={r.value.broker} onChange={e => setSide(r.side, { broker: e.target.value })}>
      {(brokers.includes(r.value.broker) ? brokers : [r.value.broker, ...brokers]).map(b => <option key={b} value={b}>{b}</option>)}
    </Select>
  );
  const pairSelect = (r: SideRow) => (
    <Select aria-label={`${r.label} pair`} value={r.value.symbol} onChange={e => setSide(r.side, { symbol: e.target.value })}>
      {pairOptions(r.value).map(s => <option key={s} value={s}>{s}</option>)}
    </Select>
  );
  const timeframeSelect = (r: SideRow) => (
    <Select aria-label={`${r.label} timeframe`} value={r.value.timeframe} onChange={e => setSide(r.side, { timeframe: e.target.value })}>
      {LAYOUT_TIMEFRAMES.map(tf => <option key={tf} value={tf}>{tf}</option>)}
    </Select>
  );

  const rows: SideRow[] = [
    { side: 'left', label: 'Left', value: selected.left },
    { side: 'right', label: 'Right', value: selected.right },
  ];

  const columns: TableColumn<SideRow>[] = [
    { key: 'chart', label: 'Chart', render: r => <span className={styles.chart}>{r.label}</span> },
    { key: 'broker', label: 'Broker', render: brokerSelect },
    { key: 'pair', label: 'Pair', render: pairSelect },
    { key: 'timeframe', label: 'Timeframe', render: timeframeSelect },
  ];

  return (
    <Section title="Split layouts" description={DESCRIPTION}>
      <div className={styles.body}>
        <div className={styles.bar}>
          <Field label="Layout" htmlFor="split-layout-pick">
            <Select id="split-layout-pick" value={selected.key} onChange={e => onSelect(e.target.value)}>
              {layouts.map(l => <option key={l.key} value={l.key}>{l.name.trim() || 'Untitled'}</option>)}
            </Select>
          </Field>
          <Field label="Name" htmlFor="split-layout-name">
            <TextInput id="split-layout-name" value={selected.name} maxLength={40} onChange={e => onChange(selected.key, { name: e.target.value })} />
          </Field>
          <div className={styles.actions}>
            <Button variant="buyOutline" onClick={onAdd}>+ New</Button>
            <Button variant="danger" onClick={onDelete}>Delete</Button>
          </div>
        </div>

        <Table
          caption="Charts of the layout"
          columns={columns}
          rows={rows}
          rowKey={r => `${selected.key}-${r.side}`}
          renderCard={r => (
            <Card title={r.label} accent="orange">
              <div className={styles.cardControls}>
                {brokerSelect(r)}
                {pairSelect(r)}
                {timeframeSelect(r)}
              </div>
            </Card>
          )}
        />
      </div>
    </Section>
  );
}
