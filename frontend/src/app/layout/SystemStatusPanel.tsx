import { useEffect, useState } from 'react';
import type { BrokerStatus, SystemLevel, SystemStatusView } from '../../lib/useSystemStatus';
import {
  LEVEL_LABEL, brokerStateLabel, formatDuration, formatFreeMemory, listedBrokers, summarize,
} from './systemStatusText';
import { LEVEL_CLASS } from './systemStatusLevel';
import styles from './SystemStatus.module.css';

interface SystemStatusPanelProps {
  view: SystemStatusView;
}

interface MetricProps {
  label: string;
  value: string;
  tone?: SystemLevel;
}

const TICK_MS = 1000;
const MS_PER_SECOND = 1000;

function Metric({ label, value, tone }: MetricProps) {
  return (
    <div className={styles.metric}>
      <span className={styles.label}>{label}</span>
      <span className={`${styles.metricValue} ${tone ? LEVEL_CLASS[tone] : ''}`}>{value}</span>
    </div>
  );
}

function BrokerRow({ broker }: { broker: BrokerStatus }) {
  const attention = broker.level !== 'ok';
  const tone = attention ? LEVEL_CLASS[broker.level] : '';
  return (
    <div className={styles.row}>
      <span className={styles.rowMain}>
        <span className={styles.rowName}>
          <span className={`${styles.dot} ${styles.dotSmall} ${LEVEL_CLASS[broker.level]}`} />
          {broker.name}
        </span>
        <span className={`${styles.label} ${styles.rowState} ${tone}`}>{brokerStateLabel(broker)}</span>
      </span>
      <span className={`${styles.rowDelay} ${tone}`}>
        {broker.tickDelayS === null ? '—' : formatDuration(broker.tickDelayS)}
      </span>
    </div>
  );
}

function useSecondsSince(timestamp: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  return timestamp === null ? null : Math.max(0, Math.round((now - timestamp) / MS_PER_SECOND));
}

export function SystemStatusPanel({ view }: SystemStatusPanelProps) {
  const { status, level, connectionLost, receivedAt } = view;
  const updatedS = useSecondsSince(receivedAt);
  const { headline, closing } = summarize(view);
  const brokers = status?.brokers ?? [];
  const listed = listedBrokers(brokers);
  const rest = brokers.length - listed.length;
  const tone = level ? LEVEL_CLASS[level] : '';

  return (
    <>
      <div className={styles.head}>
        <div className={styles.title}>
          <span className={`${styles.dot} ${tone}`} />
          <span className={`${styles.titleText} ${tone}`}>System{level ? ` · ${LEVEL_LABEL[level]}` : ''}</span>
        </div>
        <p className={styles.headline}>{headline}</p>
      </div>

      <div className={styles.metrics}>
        <Metric label="CPU" value={status?.server.cpuPct == null ? '—' : `${status.server.cpuPct} %`} />
        <Metric label="Free RAM" value={status ? formatFreeMemory(status.server.freeMemMb) : '—'} />
        <Metric label="Backend" value={connectionLost ? 'Lost' : status ? 'OK' : '—'} tone={connectionLost ? 'bad' : status ? 'ok' : undefined} />
        <Metric label="Updated" value={updatedS === null ? '—' : `${formatDuration(updatedS)} ago`} />
      </div>

      {brokers.length > 0 && (
        <div className={styles.brokers}>
          <div className={styles.brokersHead}>
            <span className={styles.label}>Brokers · {brokers.length}</span>
            <span className={styles.label}>Tick delay</span>
          </div>
          {listed.map(broker => <BrokerRow key={broker.name} broker={broker} />)}
          {rest > 0 && <div className={styles.rest}>{rest} more connected · ticks up to date</div>}
        </div>
      )}

      {closing && <p className={styles.closing}>{closing}</p>}
    </>
  );
}
