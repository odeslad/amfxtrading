import type { ReactNode } from 'react';
import styles from './Segmented.module.css';

export type SegmentTone = 'default' | 'buy' | 'sell';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  tone?: SegmentTone;
  disabled?: boolean;
}

export interface SegmentedProps<T extends string> {
  options: SegmentOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  label: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
  disabled = false,
}: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={`${styles.group} ${styles[size]}`}>
      {options.map((option) => {
        const selected = option.value === value;
        const classes = [styles.option, selected ? styles[option.tone ?? 'default'] : ''].filter(Boolean).join(' ');
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={classes}
            disabled={disabled || option.disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
