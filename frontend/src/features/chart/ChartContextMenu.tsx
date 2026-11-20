import { useEffect, useLayoutEffect, useRef } from 'react';
import styles from './ChartContextMenu.module.css';

export type MenuTone = 'buy' | 'sell' | 'danger';

export interface MenuItem {
  key: string;
  label: string;
  hint?: string;
  tone?: MenuTone;
  onSelect: () => void;
}

export interface MenuSection {
  key: string;
  title?: string;
  items: MenuItem[];
}

interface ChartContextMenuProps {
  x: number;
  y: number;
  sections: MenuSection[];
  onClose: () => void;
}

const EDGE_PX = 8;
const TONE_CLASS: Record<MenuTone, string> = { buy: styles.buy, sell: styles.sell, danger: styles.danger };

// Positioned inside the chart (so it also shows in fullscreen) and kept within it.
export function ChartContextMenu({ x, y, sections, onClose }: ChartContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useLayoutEffect(() => {
    const menu = menuRef.current;
    const parent = menu?.offsetParent as HTMLElement | null;
    if (!menu || !parent) return;
    const maxLeft = parent.clientWidth - menu.offsetWidth - EDGE_PX;
    const maxTop = parent.clientHeight - menu.offsetHeight - EDGE_PX;
    menu.style.left = `${Math.max(EDGE_PX, Math.min(x, maxLeft))}px`;
    menu.style.top = `${Math.max(EDGE_PX, Math.min(y, maxTop))}px`;
    menu.style.visibility = 'visible';
  }, [x, y, sections]);

  useEffect(() => {
    const close = () => onCloseRef.current();
    const onPointerDown = (e: Event) => {
      if (!menuRef.current?.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('wheel', close, { capture: true, passive: true });
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('wheel', close, { capture: true });
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
    };
  }, []);

  const choose = (item: MenuItem) => {
    onClose();
    item.onSelect();
  };

  return (
    <div
      ref={menuRef}
      className={styles.menu}
      role="menu"
      data-chart-interactive
      onContextMenu={e => e.preventDefault()}
      style={{ left: x, top: y }}
    >
      {sections.filter(s => s.items.length > 0).map((section, i) => (
        <div key={section.key} className={i > 0 ? styles.section : undefined}>
          {section.title && <div className={styles.title}>{section.title}</div>}
          {section.items.map(item => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className={`${styles.item} ${item.tone ? TONE_CLASS[item.tone] : ''}`}
              onClick={() => choose(item)}
            >
              <span>{item.label}</span>
              {item.hint && <span className={styles.hint}>{item.hint}</span>}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
