import type { ReactNode } from 'react';
import styles from './SelectList.module.css';

export interface SelectListItem<T extends string | number> {
  id: T;
  title: ReactNode;
  meta?: ReactNode;
  aside?: ReactNode;
}

export interface SelectListProps<T extends string | number> {
  items: SelectListItem<T>[];
  selected: T;
  onSelect: (id: T) => void;
  label: string;
}

export function SelectList<T extends string | number>({ items, selected, onSelect, label }: SelectListProps<T>) {
  return (
    <div className={styles.list} role="listbox" aria-label={label}>
      {items.map(item => {
        const active = item.id === selected;
        return (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={active}
            className={`${styles.item} ${active ? styles.active : ''}`}
            onClick={() => onSelect(item.id)}
          >
            <span className={styles.top}>
              <span>{item.title}</span>
              {item.aside && <span className={styles.aside}>{item.aside}</span>}
            </span>
            {item.meta && <span className={styles.meta}>{item.meta}</span>}
          </button>
        );
      })}
    </div>
  );
}
