import type { BrokerSymbolsState, Visibility } from '../../lib/visibility';
import type { SyncBroker } from '../../lib/useCandleSync';
import type { AccountInfo } from './MirrorTab';
import { Button, Card, EmptyState, Hint, LinkButton, Table, Toggle, type TableColumn } from '../../shared/ui';
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
    <LinkButton tone={note.error ? 'red' : 'orange'} truncate className={own.syncNote} onClick={onOpenData} title={`${note.text} · open Settings › Data`}>
      {note.text} ›
    </LinkButton>
  );
}

function Summary({ row }: { row: BrokerRow }) {
  if (!row.visible) return <>Hidden everywhere</>;
  if (row.on === null) return <>…</>;
  return (
    <>
      <span className={own.onCount}>{row.on} on</span>
      <span className={own.offCount}>{row.off === null ? ' · list pending' : ` · ${row.off} off`}</span>
    </>
  );
}

function VisibleToggle({ row, onChange }: { row: BrokerRow; onChange: (visible: boolean) => void }) {
  return <Toggle checked={row.visible} onChange={onChange} label={`Show ${row.broker}`} />;
}

function SymbolsButton({ row, onClick }: { row: BrokerRow; onClick: () => void }) {
  return (
    <Button variant="edit" size="sm" onClick={onClick} disabled={!row.visible || row.on === null}>
      Pairs
    </Button>
  );
}

export function VisibilityTab({ brokers, accounts, brokerSymbols, syncs, onOpenData, visibility, onToggleBroker, onOpenSymbols }: VisibilityTabProps) {
  if (brokers.length === 0) return <EmptyState>No brokers connected</EmptyState>;

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

  const syncOf = (broker: string) => syncs.find(s => s.broker === broker);

  const columns: TableColumn<BrokerRow>[] = [
    { key: 'broker', label: 'Broker', render: row => <span className={own.broker}>{row.broker}</span> },
    { key: 'visible', label: 'Visible', render: row => <VisibleToggle row={row} onChange={visible => onToggleBroker(row.broker, visible)} /> },
    { key: 'account', label: 'Account', render: row => accounts[row.broker]?.name ?? '—' },
    {
      key: 'symbols',
      label: 'Symbols',
      mono: true,
      render: row => (
        <span className={own.symbolsCell}>
          <span><Summary row={row} /></span>
          <SyncNote sync={syncOf(row.broker)} onOpenData={onOpenData} />
        </span>
      ),
    },
    { key: 'pairs', label: '', align: 'right', render: row => <SymbolsButton row={row} onClick={() => onOpenSymbols(row.broker)} /> },
  ];

  return (
    <div className={own.tab}>
      <Hint>What the app shows. A hidden broker keeps trading, alerting and notifying; it just leaves the lists. A pair that is off is not sent by its EA and appears nowhere; turning one on syncs its history. Mirror and Devices always show every broker.</Hint>

      <Table
        caption="Brokers"
        columns={columns}
        rows={rows}
        rowKey={row => row.broker}
        rowTone={row => (row.visible ? undefined : 'muted')}
        renderCard={row => (
          <Card
            title={row.broker}
            meta={<Summary row={row} />}
            accent={row.visible ? 'none' : 'neutral'}
            actions={
              <>
                {row.visible && <SymbolsButton row={row} onClick={() => onOpenSymbols(row.broker)} />}
                <VisibleToggle row={row} onChange={visible => onToggleBroker(row.broker, visible)} />
              </>
            }
          >
            <SyncNote sync={syncOf(row.broker)} onOpenData={onOpenData} />
          </Card>
        )}
      />
    </div>
  );
}
