import type { MouseEvent, ReactNode } from 'react';
import styles from './NavList.module.css';

export interface NavItem<T extends string> {
  id: T;
  label: ReactNode;
  summary?: ReactNode;
}

export interface NavListProps<T extends string> {
  items: NavItem<T>[];
  current: T | null;
  hrefOf: (id: T) => string;
  onSelect: (id: T) => void;
  label: string;
  mode?: 'menu' | 'list';
  heading?: ReactNode;
}

// Links keep their href so they open in a new tab; a plain click is handled by onSelect.
export function NavList<T extends string>({ items, current, hrefOf, onSelect, label, mode = 'menu', heading }: NavListProps<T>) {
  const handleClick = (id: T) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    onSelect(id);
  };

  return (
    <nav className={`${styles.nav} ${styles[mode]}`} aria-label={label}>
      {heading && <span className={styles.heading}>{heading}</span>}
      {items.map(item => {
        const active = item.id === current;
        return (
          <a
            key={item.id}
            href={hrefOf(item.id)}
            className={`${styles.item} ${active ? styles.active : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={handleClick(item.id)}
          >
            <span className={styles.text}>
              <span className={styles.label}>{item.label}</span>
              {mode === 'list' && item.summary && <span className={styles.summary}>{item.summary}</span>}
            </span>
            {mode === 'list' && <span className={styles.chevron} aria-hidden="true">›</span>}
          </a>
        );
      })}
    </nav>
  );
}
