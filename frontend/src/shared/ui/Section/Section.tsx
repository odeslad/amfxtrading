import type { ReactNode } from 'react';
import styles from './Section.module.css';

export type SectionAccent = 'none' | 'neutral' | 'green' | 'orange' | 'red';

export interface SectionProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  accent?: SectionAccent;
  flush?: boolean;
  children?: ReactNode;
}

export function Section({ title, description, actions, accent = 'none', flush = false, children }: SectionProps) {
  return (
    <section className={`${styles.section} ${styles[accent]}`}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h3 className={styles.title}>{title}</h3>
          {description && <p className={styles.description}>{description}</p>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </header>
      {children && <div className={flush ? undefined : styles.body}>{children}</div>}
    </section>
  );
}
