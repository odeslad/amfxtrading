import { useEffect, useState } from 'react';
import { errorMessage } from '../../lib/api';
import { addToast } from '../../lib/toast';
import { fetchOpenSymbols } from '../../lib/useBrokerSymbols';
import type { BrokerSymbolsState } from '../../lib/visibility';
import { Button, Chip, Hint, SidePanel } from '../../shared/ui';
import own from './SymbolsPanel.module.css';

interface SymbolsPanelProps {
  open: boolean;
  state: BrokerSymbolsState | null;
  onSave: (broker: string, symbols: string[]) => Promise<unknown>;
  onClose: () => void;
}

// Spec 056: the tracked pairs a broker offers, on (its EA streams them) or off; saved to the EA's config.json.
export function SymbolsPanel({ open, state, onSave, onClose }: SymbolsPanelProps) {
  const broker = state?.broker ?? null;
  const [draft, setDraft] = useState<string[] | null>(null);
  const [locked, setLocked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const key = open ? broker : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    setDraft(state ? [...state.active] : null);
    setError('');
  }

  useEffect(() => {
    if (!open || !broker) return;
    const ac = new AbortController();
    fetchOpenSymbols(ac.signal).then(map => setLocked(map[broker] ?? [])).catch(() => setLocked([]));
    return () => ac.abort();
  }, [open, broker]);

  const pairs = state?.available ?? state?.active ?? [];
  const on = new Set(draft ?? []);
  const lockedSet = new Set(locked);
  const changed = state !== null && draft !== null
    && (draft.length !== state.active.length || draft.some(s => !state.active.includes(s)));

  const toggle = (symbol: string) => {
    if (lockedSet.has(symbol) && on.has(symbol)) return;
    setDraft(prev => (prev ?? []).includes(symbol) ? (prev ?? []).filter(s => s !== symbol) : [...(prev ?? []), symbol]);
  };
  const allOn = () => setDraft([...pairs]);
  const allOff = () => setDraft(pairs.filter(s => lockedSet.has(s) && on.has(s)));

  const save = async () => {
    if (!broker || !draft) return;
    if (draft.length === 0) { setError('Keep at least one pair on'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(broker, draft);
      const turnedOn = draft.filter(s => !(state?.active ?? []).includes(s));
      addToast(turnedOn.length > 0
        ? `${broker} saved · ${turnedOn.join(', ')} history syncing (progress below and in Settings › Data)`
        : `${broker} pairs saved; the EA applies them within seconds`, 'success', 6000);
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Could not save the pairs'));
    } finally {
      setSaving(false);
    }
  };

  const onCount = pairs.filter(s => on.has(s)).length;
  const lockedOn = pairs.filter(s => lockedSet.has(s) && on.has(s));

  return (
    <SidePanel
      open={open}
      title={`Pairs · ${broker ?? ''}`}
      onClose={onClose}
      width="wide"
      footer={
        <div className={own.footer}>
          <Button onClick={allOn}>All on</Button>
          <Button onClick={allOff}>All off</Button>
          <Button variant="primary" className={own.save} onClick={save} disabled={!changed || saving}>
            {saving ? 'Saving…' : 'Save to EA'}
          </Button>
        </div>
      }
    >
      <div className={own.body}>
        <Hint>
          <span>
            Crosses of AUD, EUR, NZD, USD, CAD, GBP and JPY that {broker} offers.{' '}
            <span className={own.onCount}>{onCount} on</span> · {pairs.length - onCount} off
          </span>
        </Hint>
        {state?.available === null && (
          <Hint>The EA has not reported this broker's symbols yet: only the pairs it streams are listed.</Hint>
        )}

        <div className={own.grid}>
          {pairs.map(symbol => {
            const isOn = on.has(symbol);
            const isLocked = isOn && lockedSet.has(symbol);
            return (
              <Chip
                key={symbol}
                selected={isOn}
                locked={isLocked}
                title={isLocked ? 'Open positions or orders: close them before turning it off' : undefined}
                onClick={() => toggle(symbol)}
              >
                {symbol}
              </Chip>
            );
          })}
        </div>

        {lockedOn.length > 0 && <Hint tone="warning">Open positions or orders: {lockedOn.join(', ')} stay on.</Hint>}
        <Hint>Turning a pair on syncs its candle history (progress in Settings › Data).</Hint>
        {error && <Hint tone="error">{error}</Hint>}
      </div>
    </SidePanel>
  );
}
