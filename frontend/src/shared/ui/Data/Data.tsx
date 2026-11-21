import type { ReactNode } from 'react';
import { Button } from '../Button/Button';
import styles from './Data.module.css';

export type Tone = 'neutral' | 'green' | 'red' | 'gold' | 'blue' | 'orange';

export interface PagerProps {
  page: number;
  pages: number;
  onChange: (page: number) => void;
  info: ReactNode;
}

export function Pager({ page, pages, onChange, info }: PagerProps) {
  return (
    <nav className={styles.pager} aria-label="Pagination">
      <Button size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Prev
      </Button>
      <span className={styles.pagerInfo}>{info}</span>
      <Button size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Next
      </Button>
    </nav>
  );
}

export interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}

export type DotState = 'ok' | 'off' | 'busy' | 'muted' | 'attention';

export interface StatusDotProps {
  state: DotState;
  label?: string;
}

export function StatusDot({ state, label }: StatusDotProps) {
  return (
    <span
      className={`${styles.dot} ${styles[`dot_${state}`]}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

export interface ProgressBarProps {
  value: number;
  tone?: Tone;
  label?: string;
  thick?: boolean;
}

export function ProgressBar({ value, tone = 'orange', label, thick = false }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={`${styles.track} ${thick ? styles.thick : ''}`}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={`${styles.fill} ${styles[`fill_${tone}`]}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

export interface GaugeProps {
  label: string;
  value: number;
  unit?: string;
  display?: ReactNode;
  tone: Tone;
}

export function Gauge({ label, value, unit = '%', display, tone }: GaugeProps) {
  return (
    <div className={styles.gauge}>
      <span className={styles.gaugeLabel}>{label}</span>
      <span className={styles.gaugeValue}>
        {display ?? Math.round(value)}
        {unit && <span className={styles.gaugeUnit}>{unit}</span>}
      </span>
      <ProgressBar value={value} tone={tone} label={label} thick />
    </div>
  );
}

export interface StatTileProps {
  label: ReactNode;
  value: ReactNode;
  tone?: Tone;
  big?: boolean;
  push?: boolean;
}

export function StatTile({ label, value, tone = 'neutral', big = false, push = false }: StatTileProps) {
  return (
    <div className={`${styles.stat} ${push ? styles.push : ''}`}>
      <span className={styles.statLabel}>{label}</span>
      <span className={[styles.statValue, big ? styles.big : '', styles[`text_${tone}`]].join(' ')}>{value}</span>
    </div>
  );
}

export interface StatStripProps {
  children: ReactNode;
}

export function StatStrip({ children }: StatStripProps) {
  return <div className={styles.strip}>{children}</div>;
}

export interface LegendItem {
  label: ReactNode;
  color?: string;
  value?: ReactNode;
  onClick?: () => void;
}

export interface LegendProps {
  items: LegendItem[];
}

export function Legend({ items }: LegendProps) {
  return (
    <div className={styles.legend}>
      {items.map((item, index) => {
        const content = (
          <>
            {item.color && <i className={styles.swatch} style={{ background: item.color }} />}
            <span>{item.label}</span>
            {item.value !== undefined && <span className={styles.legendValue}>{item.value}</span>}
          </>
        );
        return item.onClick ? (
          <button key={index} type="button" className={`${styles.legendItem} ${styles.clickable}`} onClick={item.onClick}>
            {content}
          </button>
        ) : (
          <span key={index} className={styles.legendItem}>
            {content}
          </span>
        );
      })}
    </div>
  );
}
