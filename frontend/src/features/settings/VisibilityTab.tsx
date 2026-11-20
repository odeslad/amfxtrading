import type { BrokerSymbolsState, Visibility } from '../../lib/visibility';
import type { SyncBroker } from '../../lib/useCandleSync';
import type { AccountInfo } from './MirrorTab';
import styles from './SettingsPage.module.css';
import own from './VisibilityTab.module.css';

interface VisibilityTabProps {
  brokers: string[];
  accounts: Record<string, AccountInfo>;
  brokerSymbols: Record<string, BrokerSymbolsState>;
  syncs: SyncBroker[];
  onOpenData: () => void;
  visibility: Visibility;
  onToggleBroker: (broker: string, visible: boolean) => void;
  onOpenSymbols: (broker: string) => void;
}

interface BrokerRow {
  broker: string;
  visible: boolean;
  on: number | null;
  off: number | null;   // null while the EA has not reported what the broker offers
}

// Spec 056: what the history sync of the broker is doing, so turning a pair on shows its progress.
function syncNote(sync: SyncBroker | undefined): { text: string; error: boolean } | null {
  if (!sync) return null;
  const busy = sync.timeframes.find(t => t.state === 'running') ?? sync.timeframes.find(t => t.state === 'queued');
  if (busy) return { text: `Syncing · ${busy.timeframe} · ${busy.detail ?? ''}`, error: false };
  const failed = sync.timeframes.find(t => t.state === 'error');
  return failed ? { text: `Sync error · ${failed.detail ?? ''}`, error: true } : null;
}

function SyncNote({ sync, onOpenData }: { sync: SyncBroker | undefined; onOpenData: () => void }) {
  const note = syncNote(sync);
  if (!note) return null;
  return (
    <button type="button" className={note.error ? own.syncError : own.syncNote} onClick={onOpenData} title="Open Settings › Data">
      {note.text} ›
    </button>
  );
}

const summary = (row: BrokerRow): string => {
  if (!row.visible) return 'Hidden everywhere';
  if (row.on === null) return '…';
  return row.off === null ? `${row.on} on · list pending` : `${row.on} on · ${row.off} off`;
};

function Toggle({ row, onChange, className }: { row: BrokerRow; onChange: (visible: boolean) => void; className?: string }) {
  return (
    <label className={`${styles.toggle} ${className ?? ''}`}>
      <input type="checkbox" checked={row.visible} onChange={e => onChange(e.target.checked)} aria-label={`Show ${row.broker}`} />
      <span className={styles.toggleTrack}><span className={styles.toggleThumb} /></span>
    </label>
  );
}

function SymbolsButton({ row, onClick, className }: { row: BrokerRow; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      className={`${styles.barBtn} ${className ?? ''}`}
      onClick={onClick}
      disabled={!row.visible || row.on === null}
    >
      Pairs
    </button>
  );
}

export function VisibilityTab({ brokers, accounts, brokerSymbols, syncs, onOpenData, visibility, onToggleBroker, onOpenSymbols }: VisibilityTabProps) {
  if (brokers.length === 0) return <div className={styles.empty}>No brokers connected</div>;

  const rows: BrokerRow[] = brokers.map(broker => {
    const state = brokerSymbols[broker];
    const available = state?.available ?? null;
    return {
      broker,
      visible: !visibility.hiddenBrokers.includes(broker),
      on: state ? state.active.length : null,
      off: available ? available.filter(s => !state!.active.includes(s)).length : null,
    };
  });

  return (
    <>
      <p className={styles.desc}>What the app shows. A hidden broker keeps trading, alerting and notifying; it just leaves the lists. A pair that is off is not sent by its EA and appears nowhere; turning one on syncs its history. Mirror and Devices always show every broker.</p>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr><th>Broker</th><th>Visible</th><th>Account</th><th>Symbols</th><th aria-label="Actions"></th></tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.broker} className={row.visible ? undefined : styles.dim}>
                <td className={styles.broker}>{row.broker}</td>
                <td><Toggle row={row} onChange={visible => onToggleBroker(row.broker, visible)} /></td>
                <td className={styles.sans}>{accounts[row.broker]?.name ?? '—'}</td>
                <td className={`${own.summary}`}>
                  {summary(row)}
                  <SyncNote sync={syncs.find(s => s.broker === row.broker)} onOpenData={onOpenData} />
                </td>
                <td className={own.actions}><SymbolsButton row={row} onClick={() => onOpenSymbols(row.broker)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.cards}>
        {rows.map(row => (
          <div key={row.broker} className={`${styles.card} ${own.card} ${row.visible ? '' : styles.dim}`}>
            <span className={own.cardMain}>
              <span className={styles.cardName}>{row.broker}</span>
              <span className={`${own.summary}`}>{summary(row)}</span>
              <SyncNote sync={syncs.find(s => s.broker === row.broker)} onOpenData={onOpenData} />
            </span>
            {row.visible && <SymbolsButton row={row} onClick={() => onOpenSymbols(row.broker)} />}
            <Toggle row={row} onChange={visible => onToggleBroker(row.broker, visible)} className={own.cardToggle} />
          </div>
        ))}
      </div>
    </>
  );
}
