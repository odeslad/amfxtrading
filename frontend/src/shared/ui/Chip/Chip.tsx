import type { ButtonHTMLAttributes } from 'react';
import styles from './Chip.module.css';

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  locked?: boolean;
  onRemove?: () => void;
  removeLabel?: string;
}

export function Chip({
  selected = false,
  locked = false,
  onRemove,
  removeLabel = 'Remove',
  type = 'button',
  className,
  children,
  disabled,
  ...rest
}: ChipProps) {
  const classes = [styles.chip, selected ? styles.selected : '', locked ? styles.locked : '', className]
    .filter(Boolean)
    .join(' ');
  const chip = (
    <button
      type={type}
      aria-pressed={selected}
      className={classes}
      disabled={disabled || locked}
      {...rest}
    >
      {children}
    </button>
  );
  if (!onRemove) return chip;
  return (
    <span className={styles.removable}>
      {chip}
      <button type="button" className={styles.remove} aria-label={removeLabel} onClick={onRemove}>
        ×
      </button>
    </span>
  );
}
