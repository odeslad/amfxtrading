import { useSyncExternalStore } from 'react';
import { apiFetch } from './api';

export interface Visibility {
  hiddenBrokers: string[];
  // Spec 024's hidden symbols; since spec 056 a symbol is either streamed by its EA or not, so this
  // list is no longer used to filter (the backend turned those symbols off in each config.json).
  hiddenSymbols: Record<string, string[]>;
  // Spec 056: the pairs each EA streams (its config.json); a broker without an entry shows everything.
  activeSymbols: Record<string, string[]>;
}

export interface BrokerSymbolsState {
  broker: string;
  available: string[] | null;
  active: string[];
}

export const EMPTY_VISIBILITY: Visibility = { hiddenBrokers: [], hiddenSymbols: {}, activeSymbols: {} };

// ── External store ──────────────────────────────────────────────────────────
// Loaded once per session from /settings and /broker-symbols, replaced when Settings saves and
// updated by the `broker_symbols` WS message, so every list re-renders without a reload.

let snapshot: Visibility = EMPTY_VISIBILITY;
const listeners = new Set<() => void>();

const subscribeStore = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

const getSnapshot = (): Visibility => snapshot;

export function setVisibility(next: Visibility): void {
  snapshot = next;
  for (const l of listeners) l();
}

// Keeps the streamed pairs when Settings saves the broker visibility.
export function publishVisibility(next: Omit<Visibility, 'activeSymbols'> & Partial<Pick<Visibility, 'activeSymbols'>>): void {
  setVisibility({ ...next, activeSymbols: next.activeSymbols ?? snapshot.activeSymbols });
}

export function setBrokerSymbols(state: BrokerSymbolsState): void {
  setVisibility({ ...snapshot, activeSymbols: { ...snapshot.activeSymbols, [state.broker]: state.active } });
}

const activeOf = (list: BrokerSymbolsState[]): Record<string, string[]> =>
  Object.fromEntries(list.map(b => [b.broker, b.active]));

export function loadVisibility(signal?: AbortSignal): Promise<void> {
  return Promise.all([
    apiFetch<{ visibility?: Partial<Visibility> }>('/settings', { signal }),
    apiFetch<BrokerSymbolsState[]>('/broker-symbols', { signal }).catch(() => [] as BrokerSymbolsState[]),
  ])
    .then(([data, brokers]) => setVisibility({ ...EMPTY_VISIBILITY, ...data.visibility, activeSymbols: activeOf(brokers) }))
    .catch(() => {});
}

export function useVisibility(): Visibility {
  return useSyncExternalStore(subscribeStore, getSnapshot, getSnapshot);
}

// ── Pure helpers ────────────────────────────────────────────────────────────

export const isBrokerVisible = (v: Visibility, broker: string): boolean =>
  !v.hiddenBrokers.includes(broker);

export const isSymbolVisible = (v: Visibility, broker: string, symbol: string): boolean => {
  const active = v.activeSymbols[broker];
  if (!active) return true;
  const upper = symbol.toUpperCase();
  return active.some(s => s.toUpperCase() === upper);
};

export const visibleBrokers = <T extends { broker: string }>(v: Visibility, items: T[]): T[] =>
  items.filter(item => isBrokerVisible(v, item.broker));

export const visibleSymbols = (v: Visibility, broker: string, symbols: string[]): string[] =>
  symbols.filter(symbol => isSymbolVisible(v, broker, symbol));

export const isVisible = (v: Visibility, broker: string, symbol: string): boolean =>
  isBrokerVisible(v, broker) && isSymbolVisible(v, broker, symbol);
