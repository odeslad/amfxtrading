import type { CSSProperties } from 'react';
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

export function UiCatalogPage() {
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
    </main>
  );
}
