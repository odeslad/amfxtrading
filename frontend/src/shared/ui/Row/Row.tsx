import type { ReactNode } from 'react';
import styles from './Row.module.css';

export interface RowProps {
  label: ReactNode;
  hint?: ReactNode;
  htmlFor?: string;
  inline?: boolean;
  children: ReactNode;
}

export function Row({ label, hint, htmlFor, inline = false, children }: RowProps) {
  return (
    <div className={`${styles.row} ${inline ? styles.inline : ''}`}>
      <div className={styles.text}>
        {htmlFor ? (
          <label htmlFor={htmlFor} className={styles.label}>
            {label}
          </label>
        ) : (
          <span className={styles.label}>{label}</span>
        )}
        {hint && <span className={styles.hint}>{hint}</span>}
      </div>
      <div className={styles.control}>{children}</div>
    </div>
  );
}
