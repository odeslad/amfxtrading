import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import styles from './Menu.module.css';

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  style?: CSSProperties;
  children: ReactNode;
}

export function Popover({ open, onClose, style, children }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointer(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div ref={ref} className={styles.popover} style={style}>
      {children}
    </div>
  );
}

export type MenuItemTone = 'default' | 'buy' | 'sell' | 'danger' | 'active';

export interface MenuItem {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  tone?: MenuItemTone;
  disabled?: boolean;
  onSelect: () => void;
}

export interface MenuSection {
  id: string;
  items: MenuItem[];
}

export interface MenuProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  sections: MenuSection[];
  style?: CSSProperties;
  label: string;
}

export function Menu({ open, onClose, title, sections, style, label }: MenuProps) {
  return (
    <Popover open={open} onClose={onClose} style={style}>
      <div role="menu" aria-label={label} className={styles.menu}>
        {title && <div className={styles.title}>{title}</div>}
        {sections.map((section) => (
          <div key={section.id} role="group" className={styles.section}>
            {section.items.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className={`${styles.item} ${styles[item.tone ?? 'default']}`}
                disabled={item.disabled}
                onClick={() => {
                  item.onSelect();
                  onClose();
                }}
              >
                <span>{item.label}</span>
                {item.hint && <span className={styles.hint}>{item.hint}</span>}
              </button>
            ))}
          </div>
        ))}
      </div>
    </Popover>
  );
}
