import type { ReactNode } from 'react';
import styles from './Feedback.module.css';

export interface ToolbarProps {
  start?: ReactNode;
  end?: ReactNode;
}

export function Toolbar({ start, end }: ToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.group}>{start}</div>
      <div className={styles.group}>{end}</div>
    </div>
  );
}

export type HintTone = 'muted' | 'warning' | 'error';

export interface HintProps {
  tone?: HintTone;
  boxed?: boolean;
  title?: ReactNode;
  children: ReactNode;
}

export function Hint({ tone = 'muted', boxed = false, title, children }: HintProps) {
  const classes = [styles.hint, styles[tone], boxed ? styles.boxed : ''].filter(Boolean).join(' ');
  return (
    <div className={classes} role={tone === 'error' ? 'alert' : undefined}>
      {title && <span className={styles.hintTitle}>{title}</span>}
      <span>{children}</span>
    </div>
  );
}

export interface EmptyStateProps {
  children: ReactNode;
}

export function EmptyState({ children }: EmptyStateProps) {
  return <div className={styles.empty}>{children}</div>;
}

export interface LoadingProps {
  label?: string;
}

export function Loading({ label = 'Loading…' }: LoadingProps) {
  return (
    <div className={styles.loading} role="status" aria-live="polite">
      {label}
    </div>
  );
}
