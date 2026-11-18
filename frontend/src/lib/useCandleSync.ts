import { useCallback, useEffect, useState } from 'react';
import { apiFetch, apiSend, errorMessage } from './api';
import { addToast } from './toast';
import { useWs } from './useWs';

export const SYNC_TIMEFRAMES = ['M5', 'M15', 'H1', 'H4', 'D1'] as const;
export const TARGET_MIN = 100;
export const TARGET_MAX = 50_000;

export type SyncState = 'idle' | 'queued' | 'running' | 'done' | 'error';

export interface SyncTimeframe {
  timeframe: string;
  target: number;
  candleCount: number | null;
  lastSyncAt: string | null;
  state: SyncState;
  detail: string | null;
  done?: number;
  total?: number;
}

export interface SyncBroker {
  broker: string;
  connected: boolean;
  timeframes: SyncTimeframe[];
}

interface CandleSyncMessage extends Partial<SyncTimeframe> {
  type: string;
  broker?: string;
}

export type TargetEdits = Record<string, Record<string, string>>;

const isBusy = (state: SyncState): boolean => state === 'queued' || state === 'running';

export const brokerBusy = (b: SyncBroker): boolean => b.timeframes.some(t => isBusy(t.state));

export const validTarget = (value: string): boolean => {
  const n = Number(value);
  return Number.isInteger(n) && n >= TARGET_MIN && n <= TARGET_MAX;
};

// Settings › Data (spec 049): candles per broker and timeframe, their targets and the
// manual sync. The state of a running sync arrives live as `candle_sync` messages.
export function useCandleSync(active: boolean) {
  const [brokers, setBrokers] = useState<SyncBroker[] | null>(null);
  const [edits, setEdits] = useState<TargetEdits>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback((signal?: AbortSignal) =>
    apiFetch<SyncBroker[]>('/candle-sync', { signal }).then(setBrokers), []);

  useEffect(() => {
    if (!active) return;
    const ac = new AbortController();
    load(ac.signal).catch(() => {});
    return () => ac.abort();
  }, [active, load]);

  useWs(useCallback((data: unknown) => {
    const message = data as CandleSyncMessage;
    if (message.type !== 'candle_sync' || !message.broker || !message.timeframe) return;
    const { broker, timeframe } = message;
    const update: Partial<SyncTimeframe> = {
      state: message.state, detail: message.detail, candleCount: message.candleCount,
      lastSyncAt: message.lastSyncAt, done: message.done, total: message.total,
    };
    setBrokers(prev => prev?.map(b => b.broker !== broker ? b : {
      ...b,
      timeframes: b.timeframes.map(t => t.timeframe === timeframe ? { ...t, ...update } : t),
    }) ?? prev);
  }, []));

  const setTarget = useCallback((broker: string, timeframe: string, value: string) => {
    setEdits(prev => ({ ...prev, [broker]: { ...prev[broker], [timeframe]: value } }));
  }, []);

  const dirty = Object.values(edits).some(tfs => Object.keys(tfs).length > 0);

  const saveTargets = useCallback(async () => {
    const invalid = Object.values(edits).some(tfs => Object.values(tfs).some(v => !validTarget(v)));
    if (invalid) {
      addToast(`Targets must be whole numbers between ${TARGET_MIN} and ${TARGET_MAX.toLocaleString('en-US')}`, 'error');
      return;
    }
    setSaving(true);
    try {
      for (const [broker, tfs] of Object.entries(edits)) {
        if (Object.keys(tfs).length === 0) continue;
        const targets = Object.fromEntries(Object.entries(tfs).map(([tf, v]) => [tf, Number(v)]));
        await apiSend('/candle-sync/targets', 'PUT', { broker, targets });
      }
      setEdits({});
      await load();
      addToast('Targets saved', 'success');
    } catch (err) {
      addToast(errorMessage(err, 'Failed to save the targets'), 'error');
    } finally {
      setSaving(false);
    }
  }, [edits, load]);

  const startSync = useCallback(async (broker: string, timeframes: string[]) => {
    try {
      await apiSend('/candle-sync', 'POST', { broker, timeframes });
      setBrokers(prev => prev?.map(b => b.broker !== broker ? b : {
        ...b,
        timeframes: b.timeframes.map(t => timeframes.includes(t.timeframe) ? { ...t, state: 'queued', detail: null } : t),
      }) ?? prev);
      return true;
    } catch (err) {
      addToast(errorMessage(err, 'Failed to start the sync'), 'error');
      return false;
    }
  }, []);

  return { brokers, edits, setTarget, dirty, saving, saveTargets, startSync };
}
