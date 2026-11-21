import { Button } from '../Button/Button';
import styles from './SaveStatus.module.css';

export type SaveStatusState = 'idle' | 'pending' | 'saving' | 'saved' | 'invalid' | 'error';

export interface SaveStatusProps {
  state: SaveStatusState;
  error?: string | null;
  onRetry?: () => void;
}

const TEXT: Record<Exclude<SaveStatusState, 'idle' | 'error'>, string> = {
  pending: 'Unsaved…',
  saving: 'Saving…',
  saved: '● Saved',
  invalid: 'Not saved · fix the highlighted field',
};

export function SaveStatus({ state, error, onRetry }: SaveStatusProps) {
  return (
    <span className={styles.status} role="status" aria-live="polite">
      {state === 'error' ? (
        <>
          <span className={styles.error}>Could not save{error ? ` · ${error}` : ''}</span>
          {onRetry && <Button variant="edit" size="sm" onClick={onRetry}>Retry</Button>}
        </>
      ) : state === 'idle' ? null : (
        <span className={styles[state]}>{TEXT[state]}</span>
      )}
    </span>
  );
}
