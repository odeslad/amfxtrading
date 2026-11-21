import { useState, type CSSProperties } from 'react';
import {
  Badge,
  Button,
  ConfirmDialog,
  FilterPanel,
  Menu,
  SidePanel,
  Toaster,
  Card,
  Gauge,
  Legend,
  Pager,
  ProgressBar,
  StatStrip,
  StatTile,
  StatusDot,
  Table,
  type TableColumn,
  type TableSort,
  CardField,
  Checkbox,
  EmptyState,
  ExpandableCard,
  Hint,
  Loading,
  Row,
  Section,
  Tabs,
  Toolbar,
  Chip,
  ColorPicker,
  DateInput,
  Field,
  IsoDateInput,
  Segmented,
  IconButton,
  NumberInput,
  Select,
  TextInput,
  Toggle,
  type ButtonVariant,
} from '../shared/ui';
import { addToast } from '../lib/toast';
import { AutosaveDemo } from './AutosaveDemo';
import styles from './UiCatalogPage.module.css';

interface Token {
  name: string;
  preview: CSSProperties;
}

const COLOR_TOKENS: Token[] = [
  '--bg', '--surface', '--surface2', '--border', '--border-bright', '--text', '--muted', '--disabled',
  '--placeholder', '--orange', '--blue', '--green', '--red', '--gold',
  '--tint-orange', '--tint-green', '--tint-red', '--tint-blue', '--tint-hover', '--tint-selected', '--backdrop',
].map((name) => ({ name, preview: { background: `var(${name})` } }));

const SIZE_TOKENS: Token[] = ['--h-sm', '--h-md', '--h-lg', '--h-touch'].map((name) => ({
  name,
  preview: { height: `var(${name})`, width: `var(${name})` },
}));

const TEXT_TOKENS = ['2xs', 'xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl'];

const BUTTON_VARIANTS: ButtonVariant[] = [
  'primary', 'buy', 'sell', 'outlined', 'buyOutline', 'edit', 'danger', 'ghost', 'dashed',
];

const CLOSE_ICON = '×';

const CATALOG_PALETTE = ['#f5a623', '#3a7bd5', '#4caf84', '#e05c5c', '#c8a840', '#e8e8e8', '#9b59b6', '#1abc9c'];

type MaType = 'ema' | 'sma';
type Side = 'buy' | 'sell';
type Range = '24h' | '7d';
type CatalogTab = 'mirror' | 'display' | 'notifications' | 'data';

interface DemoPosition {
  id: string;
  broker: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  lots: number;
  open: string;
  pnl: number;
}

const POSITIONS: DemoPosition[] = [
  { id: '1', broker: '[Broker 1]', symbol: 'EURUSD', side: 'BUY', lots: 0.5, open: '1.08452', pnl: 124.5 },
  { id: '2', broker: '[Broker 2]', symbol: 'GBPJPY', side: 'SELL', lots: 0.2, open: '191.204', pnl: -38.1 },
  { id: '3', broker: '[Broker 1]', symbol: 'AUDUSD', side: 'BUY', lots: 1, open: '0.65210', pnl: 12 },
];

const POSITION_COLUMNS: TableColumn<DemoPosition>[] = [
  { key: 'broker', label: 'Broker', render: (row) => row.broker },
  { key: 'symbol', label: 'Symbol', mono: true, sortable: true, render: (row) => row.symbol },
  { key: 'side', label: 'Type', render: (row) => row.side },
  { key: 'lots', label: 'Lots', align: 'right', mono: true, sortable: true, render: (row) => row.lots.toFixed(2) },
  { key: 'open', label: 'Open', align: 'right', mono: true, render: (row) => row.open },
  {
    key: 'pnl',
    label: 'P&L',
    align: 'right',
    mono: true,
    sortable: true,
    render: (row) => (row.pnl >= 0 ? `+${row.pnl.toFixed(2)}` : row.pnl.toFixed(2)),
  },
];

function sortPositions(rows: DemoPosition[], sort: TableSort): DemoPosition[] {
  const factor = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = a[sort.key as keyof DemoPosition];
    const right = b[sort.key as keyof DemoPosition];
    return (left > right ? 1 : left < right ? -1 : 0) * factor;
  });
}

export function UiCatalogPage() {
  const [toggleOn, setToggleOn] = useState(true);
  const [toggleOff, setToggleOff] = useState(false);
  const [maType, setMaType] = useState<MaType>('ema');
  const [side, setSide] = useState<Side>('buy');
  const [range, setRange] = useState<Range>('24h');
  const [preset, setPreset] = useState('A');
  const [ratios, setRatios] = useState(['1:2', '1:3']);
  const [color, setColor] = useState('#3a7bd5');
  const [dateTime, setDateTime] = useState('21/11/2026 09:30');
  const [isoDate, setIsoDate] = useState('2026-11-21');
  const [tab, setTab] = useState<CatalogTab>('mirror');
  const [spread, setSpread] = useState(true);
  const [sort, setSort] = useState<TableSort>({ key: 'pnl', direction: 'desc' });
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dockedOpen, setDockedOpen] = useState(true);

  function handleSort(key: string) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }));
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>AMFX · UI catalog</h1>

      <section className={styles.block}>
        <h2 className={styles.heading}>Colors and tints</h2>
        <div className={styles.swatches}>
          {COLOR_TOKENS.map((token) => (
            <div key={token.name} className={styles.swatch}>
              <span className={styles.chip} style={token.preview} />
              <span className={styles.name}>{token.name}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.heading}>Type scale</h2>
        <div className={styles.typeScale}>
          {TEXT_TOKENS.map((size) => (
            <div key={size} className={styles.typeRow}>
              <span className={styles.name}>--text-{size}</span>
              <span style={{ fontSize: `var(--text-${size})` }}>1.08452 Settings</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.heading}>Control heights</h2>
        <div className={styles.swatches}>
          {SIZE_TOKENS.map((token) => (
            <div key={token.name} className={styles.swatch}>
              <span className={styles.box} style={token.preview} />
              <span className={styles.name}>{token.name}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.heading}>States</h2>
        <div className={styles.swatches}>
          <button type="button" className={styles.focusDemo}>Focus ring</button>
          <button type="button" className={styles.focusDemo} disabled>Disabled</button>
          <span className={styles.menuDemo}>--shadow-menu</span>
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.heading}>Button · sizes</h2>
        <div className={styles.swatches}>
          <Button variant="primary" size="sm">Save</Button>
          <Button variant="primary" size="md">Save</Button>
          <div className={styles.lgBox}>
            <Button variant="primary" size="lg">Save</Button>
          </div>
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.heading}>Button · variants (normal / disabled)</h2>
        <div className={styles.variantGrid}>
          {BUTTON_VARIANTS.map((variant) => (
            <div key={variant} className={styles.variantRow}>
              <span className={styles.name}>{variant}</span>
              <Button variant={variant}>{variant}</Button>
              <Button variant={variant} size="sm">{variant}</Button>
              <Button variant={variant} disabled>{variant}</Button>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.heading}>IconButton</h2>
        <div className={styles.swatches}>
          <IconButton icon={CLOSE_ICON} label="Close" />
          <IconButton icon="✎" label="Edit" />
          <IconButton icon={CLOSE_ICON} label="Delete" tone="danger" />
          <IconButton icon="▲" label="Collapse" tone="active" />
          <IconButton icon={CLOSE_ICON} label="Close panel" variant="bare" />
          <IconButton icon={CLOSE_ICON} label="Disabled" disabled />
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.heading}>Inputs</h2>
        <div className={styles.fieldGrid}>
          <Field label="Select sm" htmlFor="cat-sel-sm">
            <Select id="cat-sel-sm" size="sm" defaultValue="all">
              <option value="all">All brokers</option>
              <option value="one">[Broker 1]</option>
            </Select>
          </Field>
          <Field label="Select md" htmlFor="cat-sel-md">
            <Select id="cat-sel-md" defaultValue="EURUSD">
              <option>EURUSD</option>
              <option>GBPUSD</option>
            </Select>
          </Field>
          <Field label="Text sm" htmlFor="cat-text-sm">
            <TextInput id="cat-text-sm" size="sm" defaultValue="Preset A" />
          </Field>
          <Field label="Text md" htmlFor="cat-text-md">
            <TextInput id="cat-text-md" placeholder="Name" />
          </Field>
          <Field label="Invalid" htmlFor="cat-invalid">
            <TextInput id="cat-invalid" invalid defaultValue="0" />
          </Field>
          <Field label="Disabled" htmlFor="cat-disabled">
            <TextInput id="cat-disabled" disabled defaultValue="Locked" />
          </Field>
          <Field label="Number + unit" htmlFor="cat-number">
            <NumberInput id="cat-number" size="sm" unit="pips" defaultValue={20} />
          </Field>
          <Field label="Number md" htmlFor="cat-number-md">
            <NumberInput id="cat-number-md" defaultValue={10000} />
          </Field>
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.heading}>Checkbox · Toggle</h2>
        <div className={styles.swatches}>
          <Checkbox label="Show setup levels" defaultChecked />
          <Checkbox label="Unchecked" />
          <Checkbox label="Disabled" disabled defaultChecked />
          <Toggle label="On" checked={toggleOn} onChange={setToggleOn} />
          <Toggle label="Off" checked={toggleOff} onChange={setToggleOff} />
          <Toggle label="Disabled" checked disabled onChange={() => undefined} />
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.heading}>Segmented</h2>
        <div className={styles.swatches}>
          <Segmented
            label="MA type"
            value={maType}
            onChange={setMaType}
            options={[{ value: 'ema', label: 'EMA' }, { value: 'sma', label: 'SMA' }]}
          />
          <Segmented
            label="Side"
            value={side}
            onChange={setSide}
            options={[
              { value: 'buy', label: 'BUY', tone: 'buy' },
              { value: 'sell', label: 'SELL', tone: 'sell' },
            ]}
          />
          <Segmented
            label="Range"
            size="sm"
            value={range}
            onChange={setRange}
            options={[{ value: '24h', label: '24H' }, { value: '7d', label: '7D' }]}
          />
          <Segmented
            label="Disabled"
            value={maType}
            onChange={setMaType}
            disabled
            options={[{ value: 'ema', label: 'EMA' }, { value: 'sma', label: 'SMA' }]}
          />
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.heading}>Chip</h2>
        <div className={styles.swatches}>
          {['A', 'B', 'C'].map((name) => (
            <Chip key={name} selected={preset === name} onClick={() => setPreset(name)}>
              Preset {name}
            </Chip>
          ))}
          {ratios.map((ratio) => (
            <Chip
              key={ratio}
              selected
              onRemove={() => setRatios((current) => current.filter((item) => item !== ratio))}
              removeLabel={`Remove ${ratio}`}
            >
              {ratio}
            </Chip>
          ))}
          <Chip locked title="Has open positions">GBPJPY</Chip>
          <Chip disabled>Disabled</Chip>
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.heading}>ColorPicker · DateInput</h2>
        <div className={styles.fieldGrid}>
          <Field label="Colour">
            <ColorPicker value={color} onChange={setColor} palette={CATALOG_PALETTE} />
          </Field>
          <Field label="Date and time" htmlFor="cat-datetime">
            <DateInput id="cat-datetime" mode="datetime" value={dateTime} onChange={setDateTime} />
          </Field>
          <Field label="Date sm (ISO)" htmlFor="cat-isodate">
            <IsoDateInput id="cat-isodate" size="sm" value={isoDate} onChange={setIsoDate} />
          </Field>
          <Field label="Invalid" htmlFor="cat-date-invalid">
            <DateInput id="cat-date-invalid" mode="date" value="31/02/2026" onChange={() => undefined} invalid />
          </Field>
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.heading}>Tabs</h2>
        <Tabs
          label="Catalog tabs"
          active={tab}
          onChange={setTab}
          tabs={[
            { id: 'mirror', label: 'Mirror' },
            { id: 'display', label: 'Display' },
            { id: 'notifications', label: 'Notifications', shortLabel: 'Notif.' },
            { id: 'data', label: 'Data' },
          ]}
          actions={<Button variant="primary" size="sm">Save</Button>}
        />
      </section>

      <section className={styles.block}>
        <h2 className={styles.heading}>Section · Row · Toolbar</h2>
        <div className={styles.columns}>
          <Section
            title="Spread"
            description="ASK and BID lines on the chart."
            actions={<Button size="sm">Reset</Button>}
          >
            <Row label="Spread lines" hint="Draws ASK and BID" htmlFor="cat-spread">
              <Toggle id="cat-spread" label="Spread lines" checked={spread} onChange={setSpread} />
            </Row>
            <Row label="Line width" htmlFor="cat-width">
              <NumberInput id="cat-width" size="sm" unit="px" defaultValue={1} />
            </Row>
            <Row label="Inline on mobile" inline>
              <Checkbox aria-label="Inline" defaultChecked />
            </Row>
          </Section>
          <div className={styles.stack}>
            <Section title="[Broker 1]" accent="green" flush />
            <Section title="[Broker 2]" accent="orange" flush />
            <Section title="[Broker 3]" accent="red" flush />
            <Toolbar
              start={
                <>
                  <Button variant="buyOutline" size="sm">+ New</Button>
                  <Button size="sm">Filters</Button>
                </>
              }
              end={<span className={styles.name}>12 items</span>}
            />
          </div>
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.heading}>Card</h2>
        <div className={styles.columns}>
          <div className={styles.stack}>
            <Card
              title="ENTRY"
              meta="Fast MA touch"
              actions={
                <>
                  <IconButton icon="✎" label="Edit" />
                  <IconButton icon={CLOSE_ICON} label="Delete" tone="danger" />
                </>
              }
            />
            <Card title="#12" accent="green" meta="+2.4R" />
            <Card title="Inactive" inactive />
          </div>
          <div className={styles.stack}>
            <ExpandableCard
              defaultOpen
              summary={
                <>
                  <span className={styles.buyText}>BUY</span>
                  <span>EURUSD</span>
                  <span className={styles.pnl}>+124.50</span>
                </>
              }
              actions={
                <>
                  <Button variant="edit">Edit</Button>
                  <Button variant="danger">Close</Button>
                </>
              }
            >
              <CardField label="Broker">[BROKER 1]</CardField>
              <CardField label="Lots">0.50</CardField>
              <CardField label="Open">1.08452</CardField>
            </ExpandableCard>
            <ExpandableCard
              summary={
                <>
                  <span className={styles.sellText}>SELL</span>
                  <span>GBPJPY</span>
                  <span className={styles.pnl}>−38.10</span>
                </>
              }
            >
              <CardField label="Lots">0.20</CardField>
            </ExpandableCard>
          </div>
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.heading}>Hint · EmptyState · Loading</h2>
        <div className={styles.columns}>
          <div className={styles.stack}>
            <Hint>Each change is saved to the EA.</Hint>
            <Hint tone="warning">A pair with open positions cannot be turned off.</Hint>
            <Hint tone="error">Could not save.</Hint>
            <Hint tone="warning" boxed title="Push disabled">Enable notifications on this device.</Hint>
            <Hint tone="error" boxed>Price too close to market.</Hint>
          </div>
          <div className={styles.stack}>
            <EmptyState>No open positions</EmptyState>
            <Loading />
          </div>
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.heading}>Table (cards ≤768) · Pager</h2>
        <Table
          caption="Open positions"
          columns={POSITION_COLUMNS}
          rows={sortPositions(POSITIONS, sort)}
          rowKey={(row) => row.id}
          sort={sort}
          onSort={handleSort}
          rowTone={(row) => (row.id === '3' ? 'selected' : undefined)}
          rowActions={() => (
            <>
              <Button variant="edit" size="sm">Edit</Button>
              <Button variant="danger" size="sm">Close</Button>
            </>
          )}
          renderCard={(row) => (
            <ExpandableCard
              summary={
                <>
                  <span className={row.side === 'BUY' ? styles.buyText : styles.sellText}>{row.side}</span>
                  <span>{row.symbol}</span>
                  <span className={styles.pnl}>{row.pnl.toFixed(2)}</span>
                </>
              }
            >
              <CardField label="Broker">{row.broker}</CardField>
              <CardField label="Lots">{row.lots.toFixed(2)}</CardField>
            </ExpandableCard>
          )}
        />
        <Pager page={page} pages={4} onChange={setPage} info={`Page ${page} / 4`} />
        <Table caption="Empty" columns={POSITION_COLUMNS} rows={[]} rowKey={(row) => row.id} empty={<EmptyState>No open positions</EmptyState>} />
      </section>

      <section className={styles.block}>
        <h2 className={styles.heading}>Badge · StatusDot · ProgressBar</h2>
        <div className={styles.swatches}>
          <Badge tone="green">Active</Badge>
          <Badge>Paused</Badge>
          <Badge tone="gold">Ended</Badge>
          <Badge tone="red">3 crashes</Badge>
          <Badge tone="blue">Default</Badge>
          <StatusDot state="ok" label="Online" />
          <StatusDot state="off" label="Offline" />
          <StatusDot state="busy" label="Syncing" />
          <StatusDot state="muted" label="Unknown" />
          <StatusDot state="attention" label="Attention" />
          <div className={styles.lgBox}>
            <ProgressBar value={42} label="Sync" />
          </div>
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.heading}>Gauge · StatStrip · Legend</h2>
        <div className={styles.gauges}>
          <Gauge label="CPU" value={23} tone="green" />
          <Gauge label="Memory" value={68} tone="gold" />
          <Gauge label="Pagefile" value={91} tone="red" />
          <Gauge label="Disk" value={40} tone="green" />
        </div>
        <StatStrip>
          <StatTile label="Trades" value="142" />
          <StatTile label="Win rate" value="58.4%" />
          <StatTile label="Profit factor" value="1.62" />
          <StatTile label="Net" value="+3 412.80" tone="green" big push />
        </StatStrip>
        <Legend
          items={[
            { label: 'EURUSD · H1' },
            { label: 'EMA 20', value: '1.08431', onClick: () => undefined },
            { label: 'SMA 50', value: '1.08390', onClick: () => undefined },
          ]}
        />
        <Legend
          items={[
            { label: 'CPU', color: 'var(--blue)' },
            { label: 'Memory', color: 'var(--orange)' },
          ]}
        />
      </section>

      <section className={styles.block}>
        <h2 className={styles.heading}>SidePanel · ConfirmDialog · FilterPanel · Menu · Toast</h2>
        <div className={styles.swatches}>
          <Button onClick={() => setPanelOpen(true)}>Side panel</Button>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>Confirm dialog</Button>
          <Button onClick={() => setFiltersOpen(true)}>Filter panel</Button>
          <div className={styles.menuAnchor}>
            <Button onClick={() => setMenuOpen((current) => !current)}>Menu</Button>
            <Menu
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              label="Chart actions"
              title="EURUSD · 1.08452"
              style={{ top: 'calc(100% + 4px)', left: 0 }}
              sections={[
                {
                  id: 'quick',
                  items: [
                    { id: 'buy', label: 'Buy 0.5%', hint: 'SL 20', tone: 'buy', onSelect: () => addToast('Buy', 'success') },
                    { id: 'sell', label: 'Sell 0.5%', hint: 'SL 20', tone: 'sell', onSelect: () => addToast('Sell', 'error') },
                  ],
                },
                {
                  id: 'more',
                  items: [
                    { id: 'trade', label: 'New trade', onSelect: () => undefined },
                    { id: 'alert', label: 'Price alert', onSelect: () => undefined },
                    { id: 'delete', label: 'Delete drawing', tone: 'danger', onSelect: () => undefined },
                    { id: 'disabled', label: 'Disabled', disabled: true, onSelect: () => undefined },
                  ],
                },
              ]}
            />
          </div>
          <Button variant="buyOutline" onClick={() => addToast('Order sent', 'success')}>Toast success</Button>
          <Button variant="danger" onClick={() => addToast('Command timed out', 'error')}>Toast error</Button>
          <Button onClick={() => addToast('Sync started')}>Toast info</Button>
          <Button onClick={() => setDockedOpen((current) => !current)}>Toggle docked</Button>
        </div>
        <div className={styles.dockedDemo}>
          <div className={styles.dockedChart}>chart area</div>
          <SidePanel docked open={dockedOpen} title="New trade" onClose={() => setDockedOpen(false)}>
            <Field label="Symbol" htmlFor="cat-docked-symbol">
              <TextInput id="cat-docked-symbol" defaultValue="EURUSD" />
            </Field>
          </SidePanel>
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.heading}>Autosave · SaveStatus · NavList</h2>
        <AutosaveDemo />
      </section>

      <SidePanel
        open={panelOpen}
        title="Pairs · [Broker 1]"
        onClose={() => setPanelOpen(false)}
        width="wide"
        footer={<Button variant="primary" size="lg" onClick={() => setPanelOpen(false)}>Save to EA</Button>}
      >
        <Hint>Each change is saved to the EA.</Hint>
      </SidePanel>
      <ConfirmDialog
        open={confirmOpen}
        title="Close position"
        description="EURUSD · BUY 0.50 · [Broker 1]"
        confirmLabel="Close"
        onConfirm={() => setConfirmOpen(false)}
        onCancel={() => setConfirmOpen(false)}
      />
      <FilterPanel
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onReset={() => setFiltersOpen(false)}
        footer={<Button variant="primary" size="lg" onClick={() => setFiltersOpen(false)}>Apply</Button>}
      >
        <Field label="Broker" htmlFor="cat-filter-broker">
          <Select id="cat-filter-broker" defaultValue="all">
            <option value="all">All brokers</option>
          </Select>
        </Field>
        <Field label="From" htmlFor="cat-filter-from">
          <IsoDateInput id="cat-filter-from" value={isoDate} onChange={setIsoDate} />
        </Field>
      </FilterPanel>
      <Toaster />
    </main>
  );
}
