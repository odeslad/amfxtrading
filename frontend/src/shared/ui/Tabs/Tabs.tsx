import type { ReactNode } from 'react';
import styles from './Tabs.module.css';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  shortLabel?: string;
}

export interface TabsProps<T extends string> {
  tabs: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  label: string;
  actions?: ReactNode;
}

export function Tabs<T extends string>({ tabs, active, onChange, label, actions }: TabsProps<T>) {
  return (
    <div className={styles.bar}>
      <div role="tablist" aria-label={label} className={styles.tabs}>
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`${styles.tab} ${selected ? styles.active : ''}`}
              onClick={() => onChange(tab.id)}
            >
              <span className={tab.shortLabel ? styles.long : undefined}>{tab.label}</span>
              {tab.shortLabel && <span className={styles.short}>{tab.shortLabel}</span>}
            </button>
          );
        })}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
