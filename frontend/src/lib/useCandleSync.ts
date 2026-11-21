import { useCallback, useEffect, useState } from 'react';
import { useAutosave } from './useAutosave';
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

  // The edited targets stay as typed; once saved they are also the brokers' targets.
  const saveEdits = useCallback(async (next: TargetEdits) => {
    for (const [broker, tfs] of Object.entries(next)) {
      if (Object.keys(tfs).length === 0) continue;
      const targets = Object.fromEntries(Object.entries(tfs).map(([tf, v]) => [tf, Number(v)]));
      await apiSend('/candle-sync/targets', 'PUT', { broker, targets });
    }
    setBrokers(prev => prev?.map(b => !next[b.broker] ? b : {
      ...b,
      timeframes: b.timeframes.map(t => next[b.broker][t.timeframe] !== undefined ? { ...t, target: Number(next[b.broker][t.timeframe]) } : t),
    }) ?? prev);
  }, []);

  const validateEdits = useCallback((next: TargetEdits): string | null =>
    Object.values(next).some(tfs => Object.values(tfs).some(v => !validTarget(v)))
      ? `Targets must be whole numbers between ${TARGET_MIN} and ${TARGET_MAX.toLocaleString('en-US')}`
      : null, []);

  const targetsSave = useAutosave(edits, { save: saveEdits, validate: validateEdits, enabled: brokers !== null });

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

  return { brokers, edits, setTarget, targetsSave, startSync };
}
