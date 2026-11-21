import { useEffect, useRef, useState } from 'react';
import styles from './ColorPicker.module.css';

export interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  palette: readonly string[];
  label?: string;
}

export function ColorPicker({ value, onChange, palette, label = 'Colour' }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointer(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  function pick(color: string) {
    onChange(color);
    setOpen(false);
  }

  return (
    <div ref={ref} className={styles.wrap}>
      <button
        type="button"
        className={styles.swatch}
        style={{ background: value }}
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      />
      {open && (
        <div className={styles.popover}>
          {palette.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={color}
              aria-pressed={color === value}
              className={`${styles.cell} ${color === value ? styles.cellActive : ''}`}
              style={{ background: color }}
              onClick={() => pick(color)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
