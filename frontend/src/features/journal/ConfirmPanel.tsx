import { ConfirmDialog } from '../../shared/ui';

interface ConfirmPanelProps {
  open: boolean;
  title: string;
  description: string;
  detail?: string;
  confirmLabel?: string;
  confirmingLabel?: string;
  confirming?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmPanel({ onClose, confirmingLabel = 'Closing...', ...rest }: ConfirmPanelProps) {
  return <ConfirmDialog onCancel={onClose} confirmingLabel={confirmingLabel} {...rest} />;
}
