import { useEffect, useState } from 'react';
import { apiFetch } from './api';
import type { QuickOrders, QuickPreset } from './quickOrders';

export interface QuickOrderSetup {
  config: QuickOrders;
  presets: QuickPreset[];
}

// Spec 054: the quick order configuration and the mirror presets it may use, read once per mount.
export function useQuickOrders(): QuickOrderSetup | null {
  const [setup, setSetup] = useState<QuickOrderSetup | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    apiFetch<{ presets?: QuickPreset[]; display?: { quickOrders?: QuickOrders | null } }>('/settings', { signal: ac.signal })
      .then(data => {
        const config = data?.display?.quickOrders ?? null;
        setSetup(config ? { config, presets: data.presets ?? [] } : null);
      })
      .catch(() => {});
    return () => ac.abort();
  }, []);

  return setup;
}
