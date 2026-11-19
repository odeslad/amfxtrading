import { useEffect, useRef, useState } from 'react';
import { PALETTE } from './movingAverages';
import styles from './ColorPicker.module.css';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}

export function ColorPicker({ value, onChange, label = 'Colour' }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className={styles.wrap}>
      <button
        type="button"
        className={styles.swatch}
        style={{ background: value }}
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      />
      {open && (
        <div className={styles.popover}>
          {PALETTE.map(c => (
            <button
              key={c}
              type="button"
              aria-label={c}
              className={`${styles.cell} ${c === value ? styles.cellActive : ''}`}
              style={{ background: c }}
              onClick={() => { onChange(c); setOpen(false); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
