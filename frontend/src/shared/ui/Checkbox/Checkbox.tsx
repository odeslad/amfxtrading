import type { InputHTMLAttributes, ReactNode } from 'react';
import styles from './Checkbox.module.css';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
}

export function Checkbox({ label, className, ...rest }: CheckboxProps) {
  const box = <input type="checkbox" className={[styles.box, className].filter(Boolean).join(' ')} {...rest} />;
  if (!label) return box;
  return (
    <label className={styles.row}>
      {box}
      <span>{label}</span>
    </label>
  );
}
