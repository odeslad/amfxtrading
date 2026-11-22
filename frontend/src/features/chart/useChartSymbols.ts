import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

// The pairs a broker offers (spec 060: the right side of the split chart loads its own).
// An empty broker means "not needed" and yields an empty list.
export function useChartSymbols(broker: string): string[] {
  const [loaded, setLoaded] = useState<{ broker: string; symbols: string[] }>({ broker: '', symbols: [] });

  useEffect(() => {
    if (!broker) return;
    const ac = new AbortController();
    apiFetch<string[]>(`/symbols?broker=${encodeURIComponent(broker)}`, { signal: ac.signal })
      .then(symbols => setLoaded({ broker, symbols }))
      .catch(() => {});
    return () => ac.abort();
  }, [broker]);

  return loaded.broker === broker ? loaded.symbols : [];
}
