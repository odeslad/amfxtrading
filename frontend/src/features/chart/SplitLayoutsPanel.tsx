import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState, LinkButton, SidePanel } from '../../shared/ui';
import { isLinkedLayout, type LayoutSide, type SplitLayout } from '../../lib/useSplitLayouts';
import { isBrokerVisible, isSymbolVisible, type Visibility } from '../../lib/visibility';
import styles from './SplitLayoutsPanel.module.css';

export interface ShownCharts {
  splitOn: boolean;
  left: LayoutSide;
  right: LayoutSide;
}

interface SplitLayoutsPanelProps {
  open: boolean;
  onClose: () => void;
  layouts: SplitLayout[];
  shown: ShownCharts;
  visibility: Visibility;
  onApply: (layout: SplitLayout) => void;
}

const sameSide = (a: LayoutSide, b: LayoutSide): boolean =>
  a.broker === b.broker && a.symbol === b.symbol && a.timeframe === b.timeframe;

const isActiveLayout = (l: SplitLayout, shown: ShownCharts): boolean =>
  shown.splitOn && sameSide(l.left, shown.left) && sameSide(l.right, shown.right);

// Why a layout cannot be applied: a hidden broker or a pair turned off for its broker (AC 8).
function unavailableReason(l: SplitLayout, v: Visibility): string | null {
  for (const side of [l.left, l.right]) {
    if (!isBrokerVisible(v, side.broker)) return `${side.broker} is hidden (Settings › Brokers & data)`;
    if (!isSymbolVisible(v, side.broker, side.symbol)) return `${side.symbol} is turned off for ${side.broker} (Settings › Brokers & data)`;
  }
  return null;
}

const sideLine = (s: LayoutSide) => `${s.broker} · ${s.symbol} · ${s.timeframe}`;

export const SplitLayoutsPanel = memo(function SplitLayoutsPanel({ open, onClose, layouts, shown, visibility, onApply }: SplitLayoutsPanelProps) {
  const navigate = useNavigate();
  const openSettings = () => navigate('/settings?section=chart');

  return (
    <SidePanel open={open} title="Split layouts" onClose={onClose}>
      {layouts.length === 0 ? (
        <div className={styles.empty}>
          <EmptyState>No split layouts yet.</EmptyState>
          <p className={styles.note}>Create them in Settings › Chart, with the broker, pair and timeframe of each chart.</p>
          <LinkButton onClick={openSettings}>Open Settings</LinkButton>
        </div>
      ) : (
        <div className={styles.list}>
          {layouts.map(l => {
            const reason = unavailableReason(l, visibility);
            const active = !reason && isActiveLayout(l, shown);
            return (
              <button
                key={l.id ?? l.name}
                type="button"
                className={`${styles.item} ${active ? styles.active : ''}`}
                onClick={() => onApply(l)}
                disabled={reason !== null}
                aria-current={active || undefined}
              >
                <span className={styles.name}>
                  {l.name}
                  {active && <span className={styles.tagActive}>Active</span>}
                  {reason && <span className={styles.tagWarning}>Unavailable</span>}
                </span>
                <span className={styles.line}>L <b>{sideLine(l.left)}</b></span>
                <span className={styles.line}>R <b>{sideLine(l.right)}</b> · {isLinkedLayout(l) ? 'linked' : 'unlinked'}</span>
                {reason && <span className={styles.reason}>{reason}</span>}
              </button>
            );
          })}
          <LinkButton onClick={openSettings}>Edit layouts in Settings › Chart</LinkButton>
        </div>
      )}
    </SidePanel>
  );
});
