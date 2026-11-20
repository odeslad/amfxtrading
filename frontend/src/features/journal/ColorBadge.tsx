import { POSITION_COLOR_VALUES, nextColor, type PositionColor } from './utils/position';
import { apiSend, errorMessage } from '../../lib/api';
import { addToast } from '../../lib/toast';
import styles from './ColorBadge.module.css';

interface ColorSwatchButtonProps {
  color?: string;
  // Called with the next colour of the palette; rejects to undo it.
  onCycle: (next: string) => Promise<unknown>;
  onChange: (color: string) => void;
  label: string;
}

// Spec 055: the click-to-cycle colour dot, shared by positions/orders and accounts
// (each keeps its own colour; only the look and the palette are common).
export function ColorSwatchButton({ color, onCycle, onChange, label }: ColorSwatchButtonProps) {
  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = nextColor(color);
    onChange(next);
    try {
      await onCycle(next);
    } catch (err) {
      onChange(color ?? '');
      addToast(errorMessage(err, 'Failed to save colour'), 'error');
    }
  };

  const cssColor = color ? POSITION_COLOR_VALUES[color as PositionColor] : undefined;

  return (
    <button
      type="button"
      className={styles.badge}
      onClick={handleClick}
      onDoubleClick={e => e.stopPropagation()}
      style={cssColor ? { background: cssColor, borderColor: cssColor } : undefined}
      title={color || 'Add color'}
      aria-label={label}
    />
  );
}

interface ColorBadgeProps {
  broker: string;
  ticket: number;
  color?: string;
  onColorChange: (broker: string, ticket: number, color: string) => void;
}

export function ColorBadge({ broker, ticket, color, onColorChange }: ColorBadgeProps) {
  return (
    <ColorSwatchButton
      color={color}
      label="Color group"
      onChange={next => onColorChange(broker, ticket, next)}
      onCycle={next => apiSend('/positions/color', 'PATCH', { broker, ticket, color: next })}
    />
  );
}
