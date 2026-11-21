import { useState, type CSSProperties } from 'react';
import {
  Button,
  Checkbox,
  Field,
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

export function UiCatalogPage() {
  const [toggleOn, setToggleOn] = useState(true);
  const [toggleOff, setToggleOff] = useState(false);

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
    </main>
  );
}
