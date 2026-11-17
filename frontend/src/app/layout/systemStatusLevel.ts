import type { SystemLevel } from '../../lib/useSystemStatus';
import styles from './SystemStatus.module.css';

export const LEVEL_CLASS: Record<SystemLevel, string> = { ok: styles.ok, warn: styles.warn, bad: styles.bad };
