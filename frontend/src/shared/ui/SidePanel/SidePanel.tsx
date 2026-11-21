import { useEffect, type ReactNode } from 'react';
import { IconButton } from '../IconButton/IconButton';
import styles from './SidePanel.module.css';

export type SidePanelWidth = 'default' | 'wide';

export interface SidePanelProps {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  width?: SidePanelWidth;
  docked?: boolean;
  footer?: ReactNode;
  headerAside?: ReactNode;
  children: ReactNode;
}

export function SidePanel({
  open,
  title,
  onClose,
  width = 'default',
  docked = false,
  footer,
  headerAside,
  children,
}: SidePanelProps) {
  useEffect(() => {
    if (!open || docked) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, docked, onClose]);

  if (docked && !open) return null;

  const classes = [
    styles.panel,
    styles[width],
    docked ? styles.docked : '',
    open ? styles.open : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      {open && !docked && <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />}
      <aside className={classes} aria-hidden={!open} inert={!open}>
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <div className={styles.headerAside}>
            {headerAside}
            <IconButton icon="×" label="Close" variant="bare" onClick={onClose} />
          </div>
        </header>
        <div className={styles.body}>{children}</div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </aside>
    </>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  description: ReactNode;
  detail?: ReactNode;
  confirmLabel?: string;
  confirmingLabel?: string;
  confirming?: boolean;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  detail,
  confirmLabel = 'Confirm',
  confirmingLabel = 'Working…',
  confirming = false,
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <SidePanel open={open} title={title} onClose={onCancel}>
      <div className={styles.confirm}>
        <p className={styles.description}>{description}</p>
        {detail && <p className={styles.detail}>{detail}</p>}
        <div className={styles.confirmActions}>
          <button
            type="button"
            className={`${styles.bigButton} ${tone === 'danger' ? styles.confirmDanger : styles.confirmPrimary}`}
            onClick={onConfirm}
            disabled={confirming}
          >
            {confirming ? confirmingLabel : confirmLabel}
          </button>
          <button type="button" className={`${styles.bigButton} ${styles.cancel}`} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </SidePanel>
  );
}

export interface FilterPanelProps {
  open: boolean;
  title?: ReactNode;
  onClose: () => void;
  onReset?: () => void;
  footer?: ReactNode;
  children: ReactNode;
}

export function FilterPanel({ open, title = 'Filters', onClose, onReset, footer, children }: FilterPanelProps) {
  return (
    <SidePanel
      open={open}
      title={title}
      onClose={onClose}
      footer={
        onReset || footer ? (
          <div className={styles.filterFooter}>
            {onReset && (
              <button type="button" className={`${styles.bigButton} ${styles.cancel}`} onClick={onReset}>
                Reset
              </button>
            )}
            {footer}
          </div>
        ) : undefined
      }
    >
      <div className={styles.form}>{children}</div>
    </SidePanel>
  );
}
