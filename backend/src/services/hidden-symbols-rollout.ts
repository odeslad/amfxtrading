import type { Prisma } from '@prisma/client';
import { config } from '../config';
import { db } from '../db/client';
import { getAllPositions } from '../store/positions';
import { readActive, writeActive } from './broker-symbols';

// Spec 056 (AC 7): the symbols hidden in Settings › Visibility become pairs turned off in their EA's
// config.json, once. A broker is only handled once its positions are known (its EA is streaming), so
// a pair with open positions or orders is never turned off; brokers still unknown keep their list for
// the next run. Safe to run again: it only touches what is still in settings_display.hiddenSymbols.

export interface RolloutStep {
  broker: string;
  removed: string[];
  keptOpen: string[];
}

export interface RolloutPlan {
  steps: RolloutStep[];
  remaining: Record<string, string[]>;
}

const symbolsOf = (positions: unknown[]): Set<string> =>
  new Set(positions.map(p => (p as { symbol?: unknown }).symbol).filter((s): s is string => typeof s === 'string').map(s => s.toUpperCase()));

// Pure: what to remove from each broker's active list, given the hidden lists and the known positions.
export function planRollout(
  hidden: Record<string, string[]>,
  active: Record<string, string[]>,
  openByBroker: Map<string, Set<string>>,
): RolloutPlan {
  const steps: RolloutStep[] = [];
  const remaining: Record<string, string[]> = {};
  for (const [broker, list] of Object.entries(hidden)) {
    const open = openByBroker.get(broker);
    const current = active[broker];
    if (!open || !current) { remaining[broker] = list; continue; }
    const hiddenSet = new Set(list.map(s => s.toUpperCase()));
    const isHidden = (s: string) => hiddenSet.has(s.toUpperCase()) || hiddenSet.has(s.slice(0, 6).toUpperCase());
    const keptOpen = current.filter(s => isHidden(s) && open.has(s.toUpperCase()));
    const removed = current.filter(s => isHidden(s) && !open.has(s.toUpperCase()));
    steps.push({ broker, removed, keptOpen });
  }
  return { steps, remaining };
}

export async function rollOutHiddenSymbols(): Promise<void> {
  const row = await db.settingsDisplay.findFirst({ where: { key: 'global' }, select: { hiddenSymbols: true } });
  const hidden = (row?.hiddenSymbols ?? {}) as Record<string, string[]>;
  if (Object.keys(hidden).length === 0) return;

  const brokers = config.brokers.filter(b => b.name in hidden);
  const active = Object.fromEntries(brokers.map(b => [b.name, readActive(b.bridgePath)]));
  const openByBroker = new Map(getAllPositions().map(p => [p.broker, symbolsOf(p.positions)]));
  const { steps, remaining } = planRollout(hidden, active, openByBroker);

  for (const step of steps) {
    const bridgePath = brokers.find(b => b.name === step.broker)?.bridgePath;
    if (!bridgePath) continue;
    if (step.removed.length > 0) writeActive(bridgePath, active[step.broker].filter(s => !step.removed.includes(s)));
    console.log(`[SYMBOLS] ${step.broker}: hidden symbols turned off: ${step.removed.join(', ') || 'none'}`
      + (step.keptOpen.length > 0 ? ` · kept on (open positions): ${step.keptOpen.join(', ')}` : ''));
  }
  await db.settingsDisplay.update({ where: { key: 'global' }, data: { hiddenSymbols: remaining as Prisma.InputJsonValue } });
  if (Object.keys(remaining).length > 0) console.log(`[SYMBOLS] hidden symbols left for later (EA not streaming yet): ${Object.keys(remaining).join(', ')}`);
}

const FIRST_RUN_DELAY_MS = 60_000;
const RETRY_MS = 10 * 60_000;

// First run once the EAs have had a minute to connect, then every 10 min until nothing is left.
export function startHiddenSymbolsRollout(): void {
  const run = () => {
    rollOutHiddenSymbols()
      .then(async () => {
        const row = await db.settingsDisplay.findFirst({ where: { key: 'global' }, select: { hiddenSymbols: true } });
        if (Object.keys((row?.hiddenSymbols ?? {}) as object).length > 0) setTimeout(run, RETRY_MS).unref();
      })
      .catch(err => console.error('[SYMBOLS] hidden symbols rollout failed:', err));
  };
  setTimeout(run, FIRST_RUN_DELAY_MS).unref();
}
