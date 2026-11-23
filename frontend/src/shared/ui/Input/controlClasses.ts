import styles from './Input.module.css';

export type ControlSize = 'sm' | 'md' | 'lg';

export function controlClasses(size: ControlSize, invalid = false, extra?: string): string {
  return [styles.control, styles[size], invalid ? styles.invalid : '', extra].filter(Boolean).join(' ');
}
