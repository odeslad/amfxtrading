import { useCallback, useEffect, useState } from 'react';
import { apiFetch, isAbortError } from './api';

export type HistoryRange = '24h' | '7d';

export interface ServerEvent {
  at: string;
  kind: 'bugcheck' | 'unexpected';
  code: string | null;
  param1: string | null;
}

export interface ServerTerminal {
  broker: string;
  running: boolean | null;
  memMb: number | null;
  pipe: string | null;
  tickAgeS: number | null;
}

export interface ServerReport {
  host: string | null;
  os: string | null;
  cores: number;
  memTotalMb: number;
  bootAt: string | null;
  uptimeS: number | null;
  lastBootAfterCrash: boolean;
  cpu: number | null;
  memUsedMb: number;
  pageFileMb: number | null;
  diskFreeGb: number | null;
  diskTotalGb: number | null;
  services: { name: string; state: string }[];
  backend: { uptimeS: number; rssMb: number; restarts: number | null };
  terminals: ServerTerminal[];
  events: ServerEvent[] | null;
  sampledAt: string | null;
  staleS: number | null;
}

export interface HistoryGap {
  from: string;
  to: string;
}

export interface HistoryPoint {
  t: string;
  cpu: number;
  memUsedMb: number;
  pageFileMb: number | null;
}

const STATUS_MS = 15_000;
const HISTORY_MS = 60_000;

// Settings › Server (spec 051): polled only while the tab is open. A failed poll keeps the
// last report, so the tab can say how old it is instead of going blank.
export function useServerStatus(active: boolean) {
  const [report, setReport] = useState<ServerReport | null>(null);
  const [lastOkAt, setLastOkAt] = useState<number | null>(null);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [failing, setFailing] = useState(false);
  const [range, setRange] = useState<HistoryRange>('24h');
  const [loaded, setLoaded] = useState<{ range: HistoryRange; points: HistoryPoint[]; gaps: HistoryGap[] } | null>(null);

  const loadStatus = useCallback((signal: AbortSignal) =>
    apiFetch<ServerReport>('/server', { signal })
      .then(r => { const now = Date.now(); setReport(r); setLastOkAt(now); setCheckedAt(now); setFailing(false); })
      .catch(err => { if (!isAbortError(err)) { setFailing(true); setCheckedAt(Date.now()); } }), []);

  useEffect(() => {
    if (!active) return;
    const ac = new AbortController();
    void loadStatus(ac.signal);
    const timer = setInterval(() => void loadStatus(ac.signal), STATUS_MS);
    return () => { clearInterval(timer); ac.abort(); };
  }, [active, loadStatus]);

  useEffect(() => {
    if (!active) return;
    const ac = new AbortController();
    // A backend without /server/gaps (deployed before the frontend) still draws the chart.
    const load = () => Promise.all([
      apiFetch<HistoryPoint[]>(`/server/history?range=${range}`, { signal: ac.signal }),
      apiFetch<HistoryGap[]>(`/server/gaps?range=${range}`, { signal: ac.signal }).catch(() => [] as HistoryGap[]),
    ])
      .then(([points, gaps]) => setLoaded({ range, points, gaps }))
      .catch(() => {});
    void load();
    const timer = setInterval(() => void load(), HISTORY_MS);
    return () => { clearInterval(timer); ac.abort(); };
  }, [active, range]);

  // Points of another range are not shown while the new range loads.
  const history = loaded?.range === range ? loaded.points : null;
  const gaps = loaded?.range === range ? loaded.gaps : null;

  return { report, lastOkAt, checkedAt, failing, range, setRange, history, gaps };
}
