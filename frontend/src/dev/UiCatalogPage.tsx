import { useState, type CSSProperties } from 'react';
import {
  Button,
  Card,
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
    </main>
  );
}
