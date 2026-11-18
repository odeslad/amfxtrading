import { useState } from 'react';
import { brokerBusy, type SyncBroker, type SyncTimeframe, type TargetEdits } from '../../lib/useCandleSync';
import styles from './SettingsPage.module.css';
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

function ProgressBar({ value }: { value: number }) {
  return (
    <span className={own.progress} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <span className={own.progressFill} style={{ width: `${value}%` }} />
    </span>
  );
}

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
  const blockTone = !broker.connected ? own.blockOff : busy ? own.blockBusy : hasError ? own.blockError : own.blockIdle;

  const targetInput = (t: SyncTimeframe, className: string) => (
    <input
      type="number"
      inputMode="numeric"
      className={className}
      value={edits[t.timeframe] ?? String(t.target)}
      onChange={e => onTarget(t.timeframe, e.target.value)}
      disabled={locked}
      aria-label={`Target ${broker.broker} ${t.timeframe}`}
    />
  );

  return (
    <section className={`${own.block} ${blockTone}`}>
      <header className={own.blockHeader}>
        <span className={own.blockTitle}>
          <span className={`${own.statusDot} ${broker.connected ? (busy ? own.dotBusy : own.dotOn) : own.dotOff}`} aria-hidden="true" />
          <span className={styles.broker}>{broker.broker}</span>
          <span className={`${own.headerState} ${own[header.tone]}`}>{header.text}</span>
        </span>
        <button
          type="button"
          className={`${styles.barBtn} ${own.syncBtn}`}
          onClick={handleSync}
          disabled={locked || marked.length === 0}
        >
          {syncLabel}
        </button>
      </header>

      {broker.connected && (
        <>
          <div className={styles.tableWrapper}>
            <table className={`${styles.table} ${own.table}`}>
              <thead>
                <tr>
                  <th aria-label="Select"></th><th>TF</th><th className={own.num}>Candles in DB</th>
                  <th>Target</th><th>Last sync</th><th>State</th>
                </tr>
              </thead>
              <tbody>
                {broker.timeframes.map(t => {
                  const state = stateOf(t);
                  const pct = progress(t);
                  const isMarked = marked.includes(t.timeframe);
                  return (
                    <tr key={t.timeframe} className={isMarked ? own.marked : undefined}>
                      <td>
                        <input type="checkbox" className={own.check} checked={isMarked} disabled={locked}
                          onChange={e => toggle(t.timeframe, e.target.checked)} aria-label={`Select ${t.timeframe}`} />
                      </td>
                      <td>{t.timeframe}</td>
                      <td className={`${own.num} ${t.lastSyncAt ? '' : styles.muted}`}>{formatCount(t.candleCount)}</td>
                      <td>{targetInput(t, own.targetInput)}</td>
                      <td className={t.lastSyncAt ? '' : styles.muted}>{formatDate(t.lastSyncAt)}</td>
                      <td>
                        <span className={own.stateCell}>
                          <span className={own[state.tone]}>{state.text}</span>
                          {pct !== null && <ProgressBar value={pct} />}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className={own.rows}>
            {broker.timeframes.map(t => {
              const state = stateOf(t);
              const pct = progress(t);
              const isMarked = marked.includes(t.timeframe);
              return (
                <label key={t.timeframe} className={`${own.row} ${isMarked ? own.marked : ''}`}>
                  <input type="checkbox" className={own.check} checked={isMarked} disabled={locked}
                    onChange={e => toggle(t.timeframe, e.target.checked)} aria-label={`Select ${t.timeframe}`} />
                  <span className={own.rowMain}>
                    <span className={own.rowTitle}>{t.timeframe} <span className={own[state.tone]}>{state.text}</span></span>
                    {pct !== null && <ProgressBar value={pct} />}
                    <span className={own.rowMeta}>{formatCount(t.candleCount)} candles · {formatDate(t.lastSyncAt)}</span>
                  </span>
                  {targetInput(t, own.rowTarget)}
                </label>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

export function DataSyncTab({ brokers, edits, onTarget, onSync }: DataSyncTabProps) {
  if (brokers === null) return <div className={styles.empty}>Loading…</div>;
  if (brokers.length === 0) return <div className={styles.empty}>No brokers configured</div>;

  return (
    <>
      <p className={styles.desc}>
        Candles per broker and timeframe. Mark the timeframes to rebuild and press Sync selected: the EA fetches the
        target number of candles for every symbol of that broker and replaces the ones in the database. Target between 100 and 50 000.
      </p>
      <div className={own.blocks}>
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
    </>
  );
}
