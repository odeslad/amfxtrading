import type { MaType } from './chart.types';
import styles from './MaTypeToggle.module.css';

interface MaTypeToggleProps {
  value: MaType;
  onChange: (value: MaType) => void;
  label: string;
}

const TYPES: MaType[] = ['ema', 'sma'];

export function MaTypeToggle({ value, onChange, label }: MaTypeToggleProps) {
  return (
    <div className={styles.toggle} role="group" aria-label={label}>
      {TYPES.map(type => (
        <button
          key={type}
          type="button"
          className={type === value ? styles.active : styles.option}
          aria-pressed={type === value}
          onClick={() => onChange(type)}
        >
          {type.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
