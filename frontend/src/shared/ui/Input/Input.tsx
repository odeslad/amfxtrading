import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react';
import styles from './Input.module.css';
import { controlClasses, type ControlSize } from './controlClasses';

export type { ControlSize };

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: ControlSize;
  invalid?: boolean;
}

export function TextInput({ size = 'md', invalid = false, type = 'text', className, ...rest }: TextInputProps) {
  return <input type={type} aria-invalid={invalid || undefined} className={controlClasses(size, invalid, className)} {...rest} />;
}

export interface NumberInputProps extends Omit<TextInputProps, 'type'> {
  unit?: string;
}

export function NumberInput({ size = 'md', invalid = false, unit, className, ...rest }: NumberInputProps) {
  const input = (
    <input
      type="number"
      inputMode="decimal"
      aria-invalid={invalid || undefined}
      className={controlClasses(size, invalid, [styles.number, className].filter(Boolean).join(' '))}
      {...rest}
    />
  );
  if (!unit) return input;
  return (
    <span className={styles.withUnit}>
      {input}
      <span className={styles.unit}>{unit}</span>
    </span>
  );
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: ControlSize;
  invalid?: boolean;
}

export function Select({ size = 'md', invalid = false, className, ...rest }: SelectProps) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={controlClasses(size, invalid, [styles.select, className].filter(Boolean).join(' '))}
      {...rest}
    />
  );
}
