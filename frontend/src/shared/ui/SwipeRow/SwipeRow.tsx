import { useRef, useState, type ReactNode, type TouchEvent } from 'react';
import styles from './SwipeRow.module.css';

export interface SwipeRowProps {
  actions: ReactNode;
  children: ReactNode;
}

const SWIPE_THRESHOLD = 50;

// Touch rows like the journal's positions: swipe left reveals the actions, swipe right hides them.
export function SwipeRow({ actions, children }: SwipeRowProps) {
  const [open, setOpen] = useState(false);
  const startX = useRef(0);
  const lastDx = useRef(0);

  const handleTouchStart = (event: TouchEvent) => {
    startX.current = event.touches[0].clientX;
    lastDx.current = 0;
  };

  const handleTouchMove = (event: TouchEvent) => {
    lastDx.current = event.touches[0].clientX - startX.current;
  };

  const handleTouchEnd = () => {
    if (lastDx.current < -SWIPE_THRESHOLD) setOpen(true);
    else if (lastDx.current > SWIPE_THRESHOLD) setOpen(false);
  };

  return (
    <div className={styles.row} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      {children}
      <div className={styles.actions}>
        <div className={`${styles.actionsInner} ${open ? styles.open : ''}`}>{actions}</div>
      </div>
    </div>
  );
}
