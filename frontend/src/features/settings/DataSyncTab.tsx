import { useState } from 'react';
import { brokerBusy, type SyncBroker, type SyncTimeframe, type TargetEdits } from '../../lib/useCandleSync';
import { Button, Card, Checkbox, EmptyState, Hint, Loading, NumberInput, ProgressBar, Section, StatusDot, Table, type SectionAccent, type TableColumn } from '../../shared/ui';
import own from './DataSyncTab.module.css';

interface DataSyncTabProps {
  brokers: SyncBroker[] | null;
  edits: TargetEdits;
  onTarget: (broker: string, timeframe: string, value: string) => void;
  onSync: (broker: string, timeframes: string[]) => Promise<boolean>;
}

type Tone = 'muted' | 'ok' | 'warn' | 'busy' | 'error';

const formatCount = (n: number | null): string => (n === null ? '—' : n.toLocaleString('en-US').replace(/,/g, ' '));

const formatDate = (iso: string | null): string => {
  if (!iso) return 'never';
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${day} ${time}`;
};

function stateOf(t: SyncTimeframe): { text: string; tone: Tone } {
  switch (t.state) {
    case 'queued': return { text: 'queued', tone: 'warn' };
    case 'running': return { text: t.detail ? `running · ${t.detail}` : 'running', tone: 'busy' };
    case 'error': return { text: `✕ error · ${t.detail ?? 'unknown'}`, tone: 'error' };
    case 'done':
      return t.candleCount !== null && t.candleCount < t.target
        ? { text: `done · broker has ${formatCount(t.candleCount)} of ${formatCount(t.target)}`, tone: 'warn' }
        : { text: '✓ done', tone: 'ok' };
    default: return { text: '—', tone: 'muted' };
  }
}

function headerOf(b: SyncBroker): { text: string; tone: Tone } {
  if (!b.connected) return { text: 'EA not connected · sync unavailable', tone: 'muted' };
  const running = b.timeframes.find(t => t.state === 'running');
  if (running) return { text: `syncing · ${running.timeframe}${running.detail ? ` · ${running.detail}` : ''}`, tone: 'busy' };
  if (brokerBusy(b)) return { text: 'sync queued', tone: 'warn' };
  if (b.timeframes.some(t => t.state === 'error')) return { text: 'last sync failed · nothing was deleted', tone: 'error' };
  return { text: 'idle', tone: 'muted' };
}

const progress = (t: SyncTimeframe): number | null =>
  t.state === 'running' && t.total ? Math.round(((t.done ?? 0) / t.total) * 100) : null;

const ACCENT: Record<'off' | 'busy' | 'error' | 'idle', SectionAccent> = { off: 'neutral', busy: 'orange', error: 'red', idle: 'green' };

function BrokerBlock({ broker, edits, onTarget, onSync }: {
  broker: SyncBroker;
  edits: Record<string, string>;
  onTarget: (timeframe: string, value: string) => void;
  onSync: (timeframes: string[]) => Promise<boolean>;
}) {
  const [marked, setMarked] = useState<string[]>([]);
  const busy = brokerBusy(broker);
  const header = headerOf(broker);
  const hasError = broker.timeframes.some(t => t.state === 'error');
  const locked = busy || !broker.connected;

  const toggle = (timeframe: string, on: boolean) =>
    setMarked(prev => (on ? [...prev, timeframe] : prev.filter(tf => tf !== timeframe)));

  const handleSync = async () => {
    if (await onSync(marked)) setMarked([]);
  };

  const syncLabel = busy ? 'Sync in progress' : `${hasError ? 'Retry · ' : ''}Sync selected${marked.length > 0 ? ` (${marked.length})` : ''}`;
  const accent = ACCENT[!broker.connected ? 'off' : busy ? 'busy' : hasError ? 'error' : 'idle'];

  const select = (t: SyncTimeframe) => (
    <Checkbox checked={marked.includes(t.timeframe)} disabled={locked}
      onChange={e => toggle(t.timeframe, e.target.checked)} aria-label={`Select ${t.timeframe}`} />
  );

  const target = (t: SyncTimeframe) => (
    <NumberInput
      size="sm"
      className={own.target}
      inputMode="numeric"
      value={edits[t.timeframe] ?? String(t.target)}
      onChange={e => onTarget(t.timeframe, e.target.value)}
      disabled={locked}
      aria-label={`Target ${broker.broker} ${t.timeframe}`}
    />
  );

  const stateView = (t: SyncTimeframe) => {
    const state = stateOf(t);
    const pct = progress(t);
    return (
      <span className={own.stateCell}>
        <span className={own[state.tone]}>{state.text}</span>
        {pct !== null && <span className={own.progress}><ProgressBar value={pct} label={`${t.timeframe} progress`} /></span>}
      </span>
    );
  };

  const columns: TableColumn<SyncTimeframe>[] = [
    { key: 'select', label: '', render: select },
    { key: 'tf', label: 'TF', mono: true, render: t => t.timeframe },
    { key: 'count', label: 'Candles in DB', align: 'right', mono: true, render: t => <span className={t.lastSyncAt ? '' : own.muted}>{formatCount(t.candleCount)}</span> },
    { key: 'target', label: 'Target', render: target },
    { key: 'last', label: 'Last sync', mono: true, render: t => <span className={t.lastSyncAt ? '' : own.muted}>{formatDate(t.lastSyncAt)}</span> },
    { key: 'state', label: 'State', mono: true, render: stateView },
  ];

  return (
    <Section
      accent={accent}
      title={
        <span className={own.blockTitle}>
          <StatusDot state={broker.connected ? (busy ? 'busy' : 'ok') : 'off'} />
          <span className={own.broker}>{broker.broker}</span>
          <span className={own[header.tone]}>{header.text}</span>
        </span>
      }
      actions={
        <Button variant="edit" size="sm" onClick={handleSync} disabled={locked || marked.length === 0}>
          {syncLabel}
        </Button>
      }
      flush
    >
      {broker.connected && (
        <div className={own.tableBox}>
          <Table
            caption={`${broker.broker} timeframes`}
            columns={columns}
            rows={broker.timeframes}
            rowKey={t => t.timeframe}
            rowTone={t => (marked.includes(t.timeframe) ? 'marked' : undefined)}
            renderCard={t => (
              <Card
                title={t.timeframe}
                meta={`${formatCount(t.candleCount)} candles · ${formatDate(t.lastSyncAt)}`}
                actions={<>{target(t)}{select(t)}</>}
              >
                {stateView(t)}
              </Card>
            )}
          />
        </div>
      )}
    </Section>
  );
}

export function DataSyncTab({ brokers, edits, onTarget, onSync }: DataSyncTabProps) {
  if (brokers === null) return <Loading />;
  if (brokers.length === 0) return <EmptyState>No brokers configured</EmptyState>;

  return (
    <div className={own.tab}>
      <Hint>
        Candles per broker and timeframe. Mark the timeframes to rebuild and press Sync selected: the EA fetches the
        target number of candles for every symbol of that broker and replaces the ones in the database. Target between 100 and 50 000.
      </Hint>
      {brokers.map(b => (
        <BrokerBlock
          key={b.broker}
          broker={b}
          edits={edits[b.broker] ?? {}}
          onTarget={(tf, value) => onTarget(b.broker, tf, value)}
          onSync={tfs => onSync(b.broker, tfs)}
        />
      ))}
    </div>
  );
}
