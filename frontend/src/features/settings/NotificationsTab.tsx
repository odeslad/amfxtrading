import type { ReactNode } from 'react';
import { averagesLabel, directionLabel, eventLabel, repeatLabel, symbolsLabel, type EmaNotification } from '../../lib/useEmaNotifications';
import {
  Badge,
  Button,
  Section,
  CardField,
  EmptyState,
  ExpandableCard,
  Table,
  Toggle,
  type TableColumn,
  type Tone,
} from '../../shared/ui';
import styles from './NotificationsTab.module.css';

interface NotificationsTabProps {
  notifications: EmaNotification[];
  onToggle: (n: EmaNotification) => void;
  onEdit: (n: EmaNotification) => void;
  onDelete: (n: EmaNotification) => void;
  onNew: () => void;
}

const STATE_TONE: Record<EmaNotification['state'], Tone> = { active: 'green', paused: 'neutral', ended: 'gold' };
const STATE_LABEL: Record<EmaNotification['state'], string> = { active: 'Active', paused: 'Paused', ended: 'Ended' };

const p = (n: number) => String(n).padStart(2, '0');
// Local time, as typed in the panel.
const fmtLocal = (iso: string | null, withYear = false): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}${withYear ? '/' + d.getFullYear() : ''} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const lastFiredLabel = (n: EmaNotification): ReactNode =>
  n.lastFired
    ? <>{fmtLocal(n.lastFired.firedAt)} · {n.lastFired.symbol} <span className={n.lastFired.direction === 'buy' ? styles.buy : styles.sell}>{n.lastFired.direction === 'buy' ? '▲' : '▼'}</span></>
    : '—';

const directionClass = (n: EmaNotification): string | undefined =>
  n.direction === 'buy' ? styles.buy : n.direction === 'sell' ? styles.sell : undefined;

const StateBadge = ({ n }: { n: EmaNotification }) => <Badge tone={STATE_TONE[n.state]}>{STATE_LABEL[n.state]}</Badge>;

export function NotificationsTab({ notifications, onToggle, onEdit, onDelete, onNew }: NotificationsTabProps) {
  return (
    <Section
      title="Rules"
      description="Permanent moving-average cross rules; each one notifies by push when it fires."
    >
      <div className={styles.body}>
        {notifications.length === 0
          ? <EmptyState>No notifications yet. Create one with + New notification.</EmptyState>
          : <RulesTable notifications={notifications} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />}
        <div className={styles.addRow}>
          <Button variant="buyOutline" onClick={onNew}>+ New notification</Button>
        </div>
      </div>
    </Section>
  );
}

function RulesTable({ notifications, onToggle, onEdit, onDelete }: Omit<NotificationsTabProps, 'onNew'>) {

  const actions = (n: EmaNotification) => (
    <>
      <Button variant="edit" size="sm" onClick={() => onEdit(n)}>Edit</Button>
      <Button variant="danger" size="sm" onClick={() => onDelete(n)}>Delete</Button>
    </>
  );

  const columns: TableColumn<EmaNotification>[] = [
    { key: 'on', label: 'On', render: n => <Toggle checked={n.enabled} onChange={() => onToggle(n)} label="Active" /> },
    {
      key: 'symbols',
      label: 'Symbols',
      mono: true,
      render: n => (
        <>
          {symbolsLabel(n.symbols)}
          <span className={styles.brokerLine}>{n.broker}</span>
        </>
      ),
    },
    { key: 'tf', label: 'TF', mono: true, render: n => n.timeframe },
    { key: 'averages', label: 'Averages', mono: true, wrap: true, render: n => averagesLabel(n) },
    { key: 'event', label: 'Event', wrap: true, render: n => eventLabel(n) },
    { key: 'direction', label: 'Direction', render: n => <span className={directionClass(n)}>{directionLabel(n.direction)}</span> },
    { key: 'repeat', label: 'Repeat', wrap: true, render: n => repeatLabel(n.repeatMinutes) },
    { key: 'ends', label: 'Ends', mono: true, render: n => <span className={styles.muted}>{fmtLocal(n.endsAt, true)}</span> },
    { key: 'state', label: 'State', render: n => <StateBadge n={n} /> },
    { key: 'last', label: 'Last fired', mono: true, wrap: true, render: lastFiredLabel },
  ];

  return (
    <Table
      caption="Notifications"
      columns={columns}
      rows={notifications}
      rowKey={n => String(n.id)}
      rowTone={n => (n.state === 'active' ? undefined : 'muted')}
      rowActions={actions}
      swipeCardActions
      renderCard={n => (
        <ExpandableCard
          aside={<Toggle checked={n.enabled} onChange={() => onToggle(n)} label="Active" />}
          summary={
            <>
              <span className={directionClass(n)}>{symbolsLabel(n.symbols)}</span>
              <span className={styles.summaryTf}>{n.timeframe}</span>
              <span className={styles.summaryState}><StateBadge n={n} /></span>
            </>
          }
        >
          <CardField label="Averages">{averagesLabel(n)}</CardField>
          <CardField label="Event">{eventLabel(n)}</CardField>
          <CardField label="Direction"><span className={directionClass(n)}>{directionLabel(n.direction)}</span></CardField>
          <CardField label="Repeat">{repeatLabel(n.repeatMinutes)}</CardField>
          <CardField label="Ends">{fmtLocal(n.endsAt, true)}</CardField>
          <CardField label="Broker">{n.broker}</CardField>
          <CardField label="Last fired">{lastFiredLabel(n)}</CardField>
          {n.note && <CardField label="Note">{n.note}</CardField>}
        </ExpandableCard>
      )}
    />
  );
}
