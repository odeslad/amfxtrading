import { useCallback, useEffect, useState } from 'react';
import { apiFetch, apiSend } from './api';
import { useWs } from './useWs';

// Spec 063: named split layouts per user — the broker, pair and timeframe of each chart.

export const LAYOUT_TIMEFRAMES = ['M5', 'M15', 'H1', 'H4', 'D1'] as const;

export interface LayoutSide {
  broker: string;
  symbol: string;
  timeframe: string;
}

export interface SplitLayout {
  id?: number;
  name: string;
  left: LayoutSide;
  right: LayoutSide;
}

export const fetchSplitLayouts = (signal?: AbortSignal): Promise<SplitLayout[]> =>
  apiFetch<SplitLayout[]>('/split-layouts', { signal });

export const saveSplitLayouts = (layouts: SplitLayout[]): Promise<SplitLayout[]> =>
  apiSend<SplitLayout[]>('/split-layouts', 'PUT', { layouts });

// Both charts share broker and pair: the layout is applied linked.
export const isLinkedLayout = (l: SplitLayout): boolean =>
  l.left.broker === l.right.broker && l.left.symbol === l.right.symbol;

// The user's layouts, reloaded when the backend says they changed (this or another device).
export function useSplitLayouts(): SplitLayout[] {
  const [layouts, setLayouts] = useState<SplitLayout[]>([]);

  const reload = useCallback((signal?: AbortSignal) => fetchSplitLayouts(signal).then(setLayouts), []);

  useEffect(() => {
    const ac = new AbortController();
    reload(ac.signal).catch(() => {});
    return () => ac.abort();
  }, [reload]);

  useWs(useCallback((message: unknown) => {
    if ((message as { type?: string }).type === 'split_layouts') reload().catch(() => {});
  }, [reload]));

  return layouts;
}
