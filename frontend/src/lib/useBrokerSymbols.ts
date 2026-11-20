import { useCallback, useEffect, useState } from 'react';
import { apiFetch, apiSend } from './api';
import { subscribe } from './ws';
import { setBrokerSymbols, type BrokerSymbolsState } from './visibility';

// Spec 056: each broker's tracked pairs (what it offers, what its EA streams) for Settings › Visibility.
export function useBrokerSymbols(enabled: boolean) {
  const [brokers, setBrokers] = useState<Record<string, BrokerSymbolsState>>({});

  const apply = useCallback((state: BrokerSymbolsState) => {
    setBrokers(prev => ({ ...prev, [state.broker]: state }));
    setBrokerSymbols(state);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const ac = new AbortController();
    apiFetch<BrokerSymbolsState[]>('/broker-symbols', { signal: ac.signal })
      .then(list => setBrokers(Object.fromEntries(list.map(b => [b.broker, b]))))
      .catch(() => {});
    return () => ac.abort();
  }, [enabled]);

  useEffect(() => subscribe(data => {
    if (typeof data === 'object' && data !== null && (data as { type?: string }).type === 'broker_symbols') {
      const state = data as BrokerSymbolsState;
      setBrokers(prev => ({ ...prev, [state.broker]: state }));
    }
  }), []);

  const save = useCallback(async (broker: string, symbols: string[]) => {
    const state = await apiSend<BrokerSymbolsState>(`/broker-symbols/${encodeURIComponent(broker)}`, 'PUT', { symbols });
    apply(state);
    return state;
  }, [apply]);

  return { brokers, save };
}

// Symbols with open positions or pending orders per broker: they stay on.
export async function fetchOpenSymbols(signal?: AbortSignal): Promise<Record<string, string[]>> {
  const live = await apiFetch<{ broker: string; positions: { symbol: string }[] }[]>('/positions/live', { signal });
  return Object.fromEntries(live.map(b => [b.broker, [...new Set(b.positions.map(p => p.symbol))]]));
}
