import { useEffect, useState } from 'react';
import { apiFetch, errorMessage, isAbortError } from '../../lib/api';
import { addToast } from '../../lib/toast';
import { TIMEFRAMES, type EmaNotification, type NotificationDirection, type NotificationEvent, type NotificationInput } from '../../lib/useEmaNotifications';
import { useVisibility, visibleSymbols } from '../../lib/visibility';
import type { MaType } from '../chart/chart.types';
import { Button, Chip, DateInput, Field, Hint, Segmented, Select, SidePanel, TextInput, type SegmentOption } from '../../shared/ui';
import own from './NotificationPanel.module.css';

interface NotificationPanelProps {
  open: boolean;
  brokers: string[];
  notification: EmaNotification | null;   // null → create
  nonce: number;                           // changes on every open, so the form restarts
  onSave: (input: NotificationInput, id: number | null) => Promise<unknown>;
  onClose: () => void;
}

interface Fields {
  broker: string;
  symbols: string[];
  all: boolean;
  timeframe: string;
  emaFast: string;
  emaSlow: string;
  fastType: MaType;
  slowType: MaType;
  event: NotificationEvent;
  thresholdPips: string;
  direction: NotificationDirection;
  repeat: 'once' | 'every';
  repeatMinutes: string;
  endsAt: string;      // dd/mm/yyyy hh:mm, local time
  note: string;
}

const MA_TYPE_OPTIONS: SegmentOption<MaType>[] = [{ value: 'ema', label: 'EMA' }, { value: 'sma', label: 'SMA' }];
const EVENT_OPTIONS: SegmentOption<NotificationEvent>[] = [{ value: 'cross', label: 'Cross' }, { value: 'approach', label: 'Approach' }, { value: 'both', label: 'Both' }];
const DIRECTION_OPTIONS: SegmentOption<NotificationDirection>[] = [{ value: 'buy', label: 'Bullish', tone: 'buy' }, { value: 'sell', label: 'Bearish', tone: 'sell' }, { value: 'both', label: 'Both' }];

const pad = (n: number) => String(n).padStart(2, '0');

const toLocalInput = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// "dd/mm/yyyy hh:mm" in the browser's local time → ISO; null when not a date.
const parseLocalInput = (text: string): string | null => {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2})(?::(\d{2}))?\s*$/.exec(text);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5] ?? '0'));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const fieldsOf = (n: EmaNotification | null, brokers: string[]): Fields => ({
  broker: n?.broker ?? brokers[0] ?? '',
  symbols: n?.symbols ?? ['EURUSD'],
  all: n ? n.symbols.length === 0 : false,
  timeframe: n?.timeframe ?? 'H1',
  emaFast: String(n?.emaFast ?? 24),
  emaSlow: String(n?.emaSlow ?? 48),
  fastType: n?.fastType ?? 'ema',
  slowType: n?.slowType ?? 'ema',
  event: n?.event ?? 'both',
  thresholdPips: String(n?.thresholdPips ?? 3),
  direction: n?.direction ?? 'both',
  repeat: n && n.repeatMinutes !== null ? 'every' : 'once',
  repeatMinutes: String(n?.repeatMinutes ?? 30),
  endsAt: toLocalInput(n?.endsAt ?? null),
  note: n?.note ?? '',
});

export function NotificationPanel({ open, brokers, notification, nonce, onSave, onClose }: NotificationPanelProps) {
  const key = `${nonce}:${notification?.id ?? 'new'}`;
  const [synced, setSynced] = useState<string | null>(null);
  const [fields, setFields] = useState<Fields>(() => fieldsOf(notification, brokers));
  const [allSymbols, setSymbols] = useState<string[]>([]);
  const visibility = useVisibility();
  // Hidden symbols (spec 024) leave the chips; a rule that already names one keeps it server-side.
  const symbols = visibleSymbols(visibility, fields.broker, allSymbols);
  const [busy, setBusy] = useState(false);
  if (open && synced !== key) {
    setSynced(key);
    setFields(fieldsOf(notification, brokers));
  }

  const set = <K extends keyof Fields>(k: K) => (v: Fields[K]) => setFields(f => ({ ...f, [k]: v }));

  // Every symbol the chosen broker trades, for the chips.
  useEffect(() => {
    if (!open || !fields.broker) return;
    const ac = new AbortController();
    apiFetch<string[]>(`/symbols?broker=${encodeURIComponent(fields.broker)}`, { signal: ac.signal })
      .then(setSymbols)
      .catch(err => { if (!isAbortError(err)) setSymbols([]); });
    return () => ac.abort();
  }, [open, fields.broker]);

  const toggleSymbol = (s: string) => setFields(f => ({
    ...f, all: false,
    symbols: f.symbols.includes(s) ? f.symbols.filter(x => x !== s) : [...f.symbols, s],
  }));

  const submit = async () => {
    const emaFast = parseInt(fields.emaFast, 10);
    const emaSlow = parseInt(fields.emaSlow, 10);
    const threshold = parseFloat(fields.thresholdPips.replace(',', '.'));
    const minutes = parseInt(fields.repeatMinutes, 10);
    const endsAt = fields.endsAt.trim() === '' ? null : parseLocalInput(fields.endsAt);
    if (!fields.broker) { addToast('Choose a broker', 'error'); return; }
    if (!fields.all && fields.symbols.length === 0) { addToast('Pick at least one symbol or all symbols', 'error'); return; }
    if (!Number.isInteger(emaFast) || !Number.isInteger(emaSlow) || emaFast < 1 || emaSlow < 1 || (emaFast === emaSlow && fields.fastType === fields.slowType)) { addToast('Periods must be positive, and different for the same type', 'error'); return; }
    if (fields.event !== 'cross' && !(threshold > 0)) { addToast('The approach threshold must be a positive number of pips', 'error'); return; }
    if (fields.repeat === 'every' && !(Number.isInteger(minutes) && minutes >= 1)) { addToast('Repeat every N minutes needs a whole number ≥ 1', 'error'); return; }
    if (fields.endsAt.trim() !== '' && endsAt === null) { addToast('Ends must be DD/MM/YYYY HH:MM', 'error'); return; }
    setBusy(true);
    try {
      await onSave({
        broker: fields.broker, symbols: fields.all ? [] : fields.symbols, timeframe: fields.timeframe, emaFast, emaSlow,
        fastType: fields.fastType, slowType: fields.slowType,
        event: fields.event, thresholdPips: fields.event === 'cross' ? (threshold > 0 ? threshold : 2) : threshold,
        direction: fields.direction, repeatMinutes: fields.repeat === 'every' ? minutes : null, endsAt, note: fields.note.trim() || null,
      }, notification?.id ?? null);
      addToast(notification ? 'Notification saved' : 'Notification created', 'success');
      onClose();
    } catch (err) {
      addToast(errorMessage(err), 'error', 6000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SidePanel
      open={open}
      title={notification ? `Edit notification · ${notification.id}` : 'New notification'}
      onClose={onClose}
      footer={
        <Button variant="primary" size="lg" onClick={submit} disabled={busy}>
          {busy ? 'Saving…' : notification ? 'Save notification' : 'Create notification'}
        </Button>
      }
    >
      <div className={own.form}>
        <div className={own.grid2}>
          <Field label="Broker · candles" htmlFor="notification-broker">
            <Select id="notification-broker" value={fields.broker} onChange={e => setFields(f => ({ ...f, broker: e.target.value, symbols: [], all: false }))}>
              {brokers.map(b => <option key={b} value={b}>{b.toUpperCase()}</option>)}
            </Select>
          </Field>
          <Field label="Timeframe" htmlFor="notification-tf">
            <Select id="notification-tf" value={fields.timeframe} onChange={e => set('timeframe')(e.target.value)}>
              {TIMEFRAMES.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="Symbols">
          {symbols.length === 0 ? <Hint>No candles for this broker yet</Hint> : (
            <div className={own.chips}>
              {symbols.map(s => (
                <Chip key={s} selected={!fields.all && fields.symbols.includes(s)} onClick={() => toggleSymbol(s)}>{s}</Chip>
              ))}
            </div>
          )}
          <Chip selected={fields.all} onClick={() => setFields(f => ({ ...f, all: !f.all }))}>All symbols of the broker</Chip>
        </Field>

        <div className={own.grid2}>
          <Field label="Fast average" htmlFor="notification-fast">
            <div className={own.maInput}>
              <Segmented label="Fast average type" options={MA_TYPE_OPTIONS} value={fields.fastType} onChange={set('fastType')} />
              <TextInput id="notification-fast" inputMode="numeric" value={fields.emaFast} onChange={e => set('emaFast')(e.target.value)} />
            </div>
          </Field>
          <Field label="Slow average" htmlFor="notification-slow">
            <div className={own.maInput}>
              <Segmented label="Slow average type" options={MA_TYPE_OPTIONS} value={fields.slowType} onChange={set('slowType')} />
              <TextInput id="notification-slow" inputMode="numeric" value={fields.emaSlow} onChange={e => set('emaSlow')(e.target.value)} />
            </div>
          </Field>
        </div>

        <Field label="Event">
          <Segmented label="Event" options={EVENT_OPTIONS} value={fields.event} onChange={set('event')} />
        </Field>

        {fields.event !== 'cross' && (
          <Field label="Approach threshold · pips" htmlFor="notification-threshold">
            <TextInput id="notification-threshold" inputMode="decimal" value={fields.thresholdPips} onChange={e => set('thresholdPips')(e.target.value)} />
          </Field>
        )}

        <Field label="Direction">
          <Segmented label="Direction" options={DIRECTION_OPTIONS} value={fields.direction} onChange={set('direction')} />
        </Field>

        <div className={own.grid2}>
          <Field label="Repeat" htmlFor="notification-repeat">
            <Select id="notification-repeat" value={fields.repeat} onChange={e => set('repeat')(e.target.value as Fields['repeat'])}>
              <option value="once">Once per event</option>
              <option value="every">Every N min</option>
            </Select>
          </Field>
          <Field label="Every · minutes" htmlFor="notification-minutes">
            <TextInput id="notification-minutes" inputMode="numeric" value={fields.repeatMinutes} disabled={fields.repeat !== 'every'} onChange={e => set('repeatMinutes')(e.target.value)} />
          </Field>
        </div>

        <Field label="Ends · empty = no end" htmlFor="notification-ends">
          <DateInput id="notification-ends" mode="datetime" value={fields.endsAt} onChange={set('endsAt')} />
        </Field>

        <Field label="Note" htmlFor="notification-note">
          <TextInput id="notification-note" placeholder="optional" maxLength={500} value={fields.note} onChange={e => set('note')(e.target.value)} />
        </Field>
      </div>
    </SidePanel>
  );
}
