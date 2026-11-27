import { useEffect, useState, useCallback, useMemo } from 'react';
import { apiFetch, errorMessage } from '../../lib/api';
import { useWs } from '../../lib/useWs';
import { useSort, type SortColumn } from '../../lib/useSort';
import { isVisible, useVisibility, visibleBrokers } from '../../lib/visibility';
import { useLivePositions } from './useLivePositions';
import { fmt, currencySymbol, isPending } from './utils/position';
import { AccountCard } from './AccountCard';
import { matchesColorFilter } from './utils/colorFilter';
import { ColorSwatchButton } from './ColorBadge';
import { apiSend } from '../../lib/api';
import styles from './JournalPage.module.css';

interface Balance {
  id: number;
  broker: string;
  balance: number;
  equity: number;
  profit: number;
  margin: number;
  freeMargin: number;
  leverage: number;
  currency: string;
  name: string;
  number: number;
  timestamp: string;
  color: string;
}


const countsLabel = (c: AccountCounts): string => `${c.trades} / ${c.orders}`;

const dayPnlClass = (value: number): string =>
  value === 0 ? styles.muted : value > 0 ? styles.profit : styles.loss;

type ColumnKey =
  | 'broker' | 'name' | 'number' | 'trades' | 'balance' | 'equity' | 'profit'
  | 'dayPnl' | 'margin' | 'freeMargin' | 'leverage' | 'currency';

// Spec 055: open positions and pending orders per broker, from the live feed.
export interface AccountCounts {
  trades: number;
  orders: number;
}

const NO_COUNTS: AccountCounts = { trades: 0, orders: 0 };

const buildColumns = (dayPnl: Record<string, number>, counts: Map<string, AccountCounts>): SortColumn<Balance, ColumnKey>[] => [
  { key: 'broker', label: 'Broker', value: b => b.broker },
  { key: 'name', label: 'Account', value: b => b.name },
  { key: 'number', label: 'Number', value: b => b.number },
  { key: 'trades', label: 'Tr. / Or.', value: b => counts.get(b.broker)?.trades ?? 0 },
  { key: 'balance', label: 'Balance', value: b => b.balance },
  { key: 'equity', label: 'Equity', value: b => b.equity },
  { key: 'profit', label: 'Profit', value: b => b.profit },
  { key: 'dayPnl', label: 'Day P&L', value: b => dayPnl[b.broker] },
  { key: 'margin', label: 'Margin', value: b => b.margin },
  { key: 'freeMargin', label: 'Free Margin', value: b => b.freeMargin },
  { key: 'leverage', label: 'Leverage', value: b => b.leverage },
  { key: 'currency', label: 'Currency', value: b => b.currency },
];

export interface AccountFilters {
  broker: string;
  name: string;
  color: string;
}

interface AccountsProps {
  onSelectBroker?: (broker: string) => void;
  filters: AccountFilters;
  onOptionsChange: (options: { brokers: string[]; colors: string[] }) => void;
}

export function Accounts({ onSelectBroker, filters, onOptionsChange }: AccountsProps) {
  const [balances, setBalances] = useState<Balance[]>([]);
  // Spec 064: the closed part of the Day P&L comes with each account message; null while the pipe is not live.
  const [closedToday, setClosedToday] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<Balance[]>('/balances')
      .then(setBalances)
      .catch(err => setError(errorMessage(err, 'Failed to load balances')))
      .finally(() => setLoading(false));
  }, []);

  // Day P&L = closed today + the floating result (equity − balance), at the pace of the Profit.
  const dayPnl = useMemo(() => {
    const result: Record<string, number> = {};
    for (const b of balances) {
      const closed = closedToday[b.broker];
      if (closed != null) result[b.broker] = closed + b.equity - b.balance;
    }
    return result;
  }, [balances, closedToday]);

  const handleWsMessage = useCallback((data: unknown) => {
    if (typeof data !== 'object' || data === null) return;
    const msg = data as { type: string; broker: string; account: Balance; closedToday?: number | null };
    if (msg.type !== 'account') return;
    setClosedToday(prev => (prev[msg.broker] === (msg.closedToday ?? null) ? prev : { ...prev, [msg.broker]: msg.closedToday ?? null }));
    setBalances(prev => {
      const withoutBroker = prev.filter(b => b.broker !== msg.broker);
      // The colour is not in the EA's account message: keep the one loaded from /balances.
      const color = prev.find(b => b.broker === msg.broker)?.color ?? '';
      return [...withoutBroker, { ...msg.account, broker: msg.broker, color }]
        .sort((a, b) => a.broker.localeCompare(b.broker));
    });
  }, []);

  useWs(handleWsMessage);

  const setColor = useCallback((broker: string, color: string) => {
    setBalances(prev => prev.map(b => (b.broker === broker ? { ...b, color } : b)));
  }, []);
  const saveColor = (broker: string) => (color: string) => apiSend('/balances/color', 'PATCH', { broker, color });

  const visibility = useVisibility();
  const visible = useMemo(() => visibleBrokers(visibility, balances), [visibility, balances]);
  const { positions } = useLivePositions();
  const counts = useMemo(() => {
    const map = new Map<string, AccountCounts>();
    for (const p of positions) {
      if (!p.broker || !isVisible(visibility, p.broker, p.symbol)) continue;
      const c = map.get(p.broker) ?? { trades: 0, orders: 0 };
      if (isPending(p.type)) c.orders += 1; else c.trades += 1;
      map.set(p.broker, c);
    }
    return map;
  }, [positions, visibility]);
  const columns = useMemo(() => buildColumns(dayPnl, counts), [dayPnl, counts]);
  const nameQuery = filters.name.trim().toLowerCase();
  const filtered = useMemo(
    () => visible.filter(b => (!filters.broker || b.broker === filters.broker) && (!nameQuery || b.name.toLowerCase().includes(nameQuery)) && matchesColorFilter(filters.color, b.color)),
    [visible, filters.broker, nameQuery, filters.color],
  );
  const optionsKey = [visible.map(b => b.broker), visible.map(b => b.color)].map(l => l.join('\u001f')).join('|');
  useEffect(() => {
    const [brokerList, colorList] = optionsKey.split('|').map(l => l.split('\u001f').filter(Boolean));
    onOptionsChange({
      brokers: [...brokerList].sort(),
      colors: [...new Set(colorList)],
    });
  }, [optionsKey, onOptionsChange]);
  const { sorted, sort, toggle } = useSort(filtered, columns, { key: 'broker', dir: 'asc' });

  if (loading) return <div className={styles.empty}>Loading...</div>;
  if (error) return <div className={styles.empty}>{error}</div>;
  if (visible.length === 0) return <div className={styles.empty}>{balances.length === 0 ? 'No accounts' : 'Every account is hidden in Settings'}</div>;
  if (filtered.length === 0) return <div className={styles.empty}>No accounts match the filters</div>;

  return (
    <>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map(c => (
                <th
                  key={c.key}
                  className={`${styles.sortable} ${sort.key === c.key ? styles.sortActive : ''}`}
                  onClick={() => toggle(c.key)}
                  aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  {c.label}
                  {sort.key === c.key && <span className={styles.sortArrow}>{sort.dir === 'asc' ? '▲' : '▼'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(b => (
              <tr
                key={b.broker}
                className={[
                  onSelectBroker ? styles.accountRow : '',
                  dayPnl[b.broker] == null ? styles.inactiveRow : '',
                ].join(' ')}
                onDoubleClick={() => onSelectBroker?.(b.broker)}
                title={onSelectBroker ? 'Double-click to see positions' : undefined}
              >
                <td className={styles.broker}>{b.broker}</td>
                <td>
                  <span className={styles.symbolCell}>
                    <ColorSwatchButton color={b.color} label={`${b.broker} colour`} onChange={c => setColor(b.broker, c)} onCycle={saveColor(b.broker)} />
                    {b.name}
                  </span>
                </td>
                <td>{b.number}</td>
                <td>{countsLabel(counts.get(b.broker) ?? NO_COUNTS)}</td>
                <td>{fmt(b.balance, 2)} {currencySymbol(b.currency)}</td>
                <td>{fmt(b.equity, 2)} {currencySymbol(b.currency)}</td>
                <td className={b.profit >= 0 ? styles.profit : styles.loss}>
                  {b.profit >= 0 ? '+' : ''}{fmt(b.profit, 2)} {currencySymbol(b.currency)}
                </td>
                <td className={dayPnl[b.broker] != null ? dayPnlClass(dayPnl[b.broker]) : styles.muted}>
                  {dayPnl[b.broker] != null
                    ? `${dayPnl[b.broker] >= 0 ? '+' : ''}${fmt(dayPnl[b.broker], 2)} ${currencySymbol(b.currency)}`
                    : '—'}
                </td>
                <td>{fmt(b.margin, 2)} {currencySymbol(b.currency)}</td>
                <td>{fmt(b.freeMargin, 2)} {currencySymbol(b.currency)}</td>
                <td>1:{b.leverage}</td>
                <td>{b.currency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.cards}>
        {sorted.map(b => (
          <AccountCard key={b.broker} balance={b} dayPnl={dayPnl[b.broker]} counts={countsLabel(counts.get(b.broker) ?? NO_COUNTS)} colorBadge={<ColorSwatchButton color={b.color} label={`${b.broker} colour`} onChange={c => setColor(b.broker, c)} onCycle={saveColor(b.broker)} />} onSelect={onSelectBroker ? () => onSelectBroker(b.broker) : undefined} />
        ))}
      </div>
    </>
  );
}
