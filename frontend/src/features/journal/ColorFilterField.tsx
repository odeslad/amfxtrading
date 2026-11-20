import { POSITION_COLORS, POSITION_COLOR_VALUES } from './utils/position';
import { parseColorFilter, toggleColorFilter } from './utils/colorFilter';
import styles from './ColorFilterField.module.css';

interface ColorFilterFieldProps {
  value: string;
  available: string[];
  onChange: (value: string) => void;
  labelClassName: string;
  fieldClassName: string;
}

// Spec 055: one dot per colour in use; each click selects or clears it; none selected = all colours.
export function ColorFilterField({ value, available, onChange, labelClassName, fieldClassName }: ColorFilterFieldProps) {
  const selected = parseColorFilter(value);
  const colors = POSITION_COLORS.filter(c => available.includes(c));
  if (colors.length === 0) return null;

  return (
    <div className={fieldClassName}>
      <span className={labelClassName}>Color</span>
      <div className={styles.dots} role="group" aria-label="Colors">
        {colors.map(c => {
          const on = selected.includes(c);
          return (
            <button
              key={c}
              type="button"
              className={on ? `${styles.dot} ${styles.dotOn}` : styles.dot}
              style={{ borderColor: POSITION_COLOR_VALUES[c], background: on ? POSITION_COLOR_VALUES[c] : 'transparent' }}
              aria-pressed={on}
              aria-label={c}
              title={c.charAt(0).toUpperCase() + c.slice(1)}
              onClick={() => onChange(toggleColorFilter(value, c))}
            />
          );
        })}
      </div>
    </div>
  );
}
