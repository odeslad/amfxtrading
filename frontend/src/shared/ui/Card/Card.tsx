import { useState, type ReactNode } from 'react';
import styles from './Card.module.css';

export type CardAccent = 'none' | 'green' | 'red' | 'gold' | 'neutral';

export interface CardProps {
  title?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  accent?: CardAccent;
  inactive?: boolean;
  children?: ReactNode;
}

export function Card({ title, meta, actions, accent = 'none', inactive = false, children }: CardProps) {
  const classes = [styles.card, styles[accent], inactive ? styles.inactive : ''].filter(Boolean).join(' ');
  return (
    <article className={classes}>
      {(title || actions) && (
        <header className={styles.head}>
          <div className={styles.heading}>
            {title && <span className={styles.title}>{title}</span>}
            {meta && <span className={styles.meta}>{meta}</span>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </header>
      )}
      {children}
    </article>
  );
}

export interface CardFieldProps {
  label: ReactNode;
  children: ReactNode;
}

export function CardField({ label, children }: CardFieldProps) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={styles.fieldValue}>{children}</span>
    </div>
  );
}

export interface ExpandableCardProps {
  summary: ReactNode;
  actions?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function ExpandableCard({ summary, actions, defaultOpen = false, children }: ExpandableCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`${styles.expandable} ${open ? styles.open : ''}`}>
      <button type="button" className={styles.summary} aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        {summary}
      </button>
      {open && (
        <div className={styles.details}>
          {children}
          {actions && <div className={styles.detailActions}>{actions}</div>}
        </div>
      )}
    </div>
  );
}
