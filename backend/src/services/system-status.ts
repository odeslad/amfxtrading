import type { BrokerLiveness } from '../store/liveness';
import type { ServerMemory } from './server-load';

export type Level = 'ok' | 'warn' | 'bad';
export type BrokerState = 'connected' | 'loading' | 'restarting' | 'disconnected';

export interface BrokerStatus {
  name: string;
  state: BrokerState;
  tickDelayS: number | null;
  loadDone?: number;
  loadTotal?: number;
  disconnectedS?: number;
}

export interface SystemStatus {
  level: Level;
  server: ServerMemory & { cpuPct: number | null };
  brokers: BrokerStatus[];
  at: string;
}

export interface StatusSample {
  now: Date;
  brokers: Map<string, BrokerLiveness>;
  hiddenBrokers: readonly string[];
  cpuPct: number | null;
  memory: ServerMemory;
}

export interface StatusTracker {
  cpuSamples: number[];
  lastRawLevel: Level | null;
  status: SystemStatus | null;
}

// Every figure that decides the colour of the light lives here.
export const THRESHOLDS = {
  sampleS: 5,
  pipeGraceS: 120,
  tickDelayS: { warn: 5, bad: 60 },
  cpuPct: { warn: 85, bad: 95 },
  cpuWindowS: { warn: 15, bad: 60 },
  freeMemPct: { warn: 10, bad: 5 },
} as const;

const SEVERITY: Record<Level, number> = { ok: 0, warn: 1, bad: 2 };
const LEVELS: readonly Level[] = ['ok', 'warn', 'bad'];

const worst = (levels: Level[]): Level => LEVELS[Math.max(0, ...levels.map(l => SEVERITY[l]))];
const mildest = (a: Level, b: Level): Level => (SEVERITY[a] <= SEVERITY[b] ? a : b);

const ageS = (now: Date, at: Date | null): number | null =>
  at ? Math.max(0, Math.round((now.getTime() - at.getTime()) / 1000)) : null;

const samplesIn = (windowS: number): number => Math.ceil(windowS / THRESHOLDS.sampleS);

export const emptyTracker = (): StatusTracker => ({ cpuSamples: [], lastRawLevel: null, status: null });

// A disabled pipe (local development) expects nothing from its EA: it counts as connected.
export function brokerStatus(name: string, broker: BrokerLiveness, now: Date): BrokerStatus {
  if (broker.pipe === 'connected' || broker.pipe === 'disabled') {
    const tickDelayS = broker.pipe === 'connected' ? ageS(now, broker.lastTickAt) : null;
    const ea = broker.eaStatus;
    return ea?.loading
      ? { name, state: 'loading', tickDelayS, loadDone: ea.loadDone, loadTotal: ea.loadTotal }
      : { name, state: 'connected', tickDelayS };
  }
  const disconnectedS = ageS(now, broker.pipeLostAt) ?? 0;
  const state: BrokerState = disconnectedS < THRESHOLDS.pipeGraceS ? 'restarting' : 'disconnected';
  return { name, state, tickDelayS: null, disconnectedS };
}

function brokerLevel(broker: BrokerStatus): Level {
  if (broker.state === 'disconnected') return 'bad';
  const delay = broker.tickDelayS ?? 0;
  if (delay >= THRESHOLDS.tickDelayS.bad) return 'bad';
  if (broker.state !== 'connected' || delay >= THRESHOLDS.tickDelayS.warn) return 'warn';
  return 'ok';
}

// The average only counts once the whole window has been sampled.
function cpuAverage(samples: readonly number[], windowS: number): number | null {
  const count = samplesIn(windowS);
  if (samples.length < count) return null;
  return samples.slice(-count).reduce((sum, pct) => sum + pct, 0) / count;
}

function cpuLevel(samples: readonly number[]): Level {
  const { cpuPct, cpuWindowS } = THRESHOLDS;
  if ((cpuAverage(samples, cpuWindowS.bad) ?? 0) >= cpuPct.bad) return 'bad';
  if ((cpuAverage(samples, cpuWindowS.warn) ?? 0) >= cpuPct.warn) return 'warn';
  return 'ok';
}

function memoryLevel({ freeMemMb, totalMemMb }: ServerMemory): Level {
  if (totalMemMb <= 0) return 'ok';
  const freePct = (freeMemMb / totalMemMb) * 100;
  if (freePct < THRESHOLDS.freeMemPct.bad) return 'bad';
  if (freePct < THRESHOLDS.freeMemPct.warn) return 'warn';
  return 'ok';
}

// The published level follows the raw one only when two consecutive samples
// agree on the move, so a single spike never changes the light.
function settle(published: Level | null, previousRaw: Level | null, raw: Level): Level {
  if (published === null || previousRaw === null) return raw;
  const held = mildest(previousRaw, raw);
  if (SEVERITY[held] > SEVERITY[published]) return held;
  const peak = worst([previousRaw, raw]);
  if (SEVERITY[peak] < SEVERITY[published]) return peak;
  return published;
}

export function nextStatus(tracker: StatusTracker, sample: StatusSample): StatusTracker {
  const hidden = new Set(sample.hiddenBrokers);
  const brokers = [...sample.brokers]
    .filter(([name]) => !hidden.has(name))
    .map(([name, broker]) => brokerStatus(name, broker, sample.now));

  const cpuSamples = sample.cpuPct === null
    ? tracker.cpuSamples
    : [...tracker.cpuSamples, sample.cpuPct].slice(-samplesIn(THRESHOLDS.cpuWindowS.bad));

  const raw = worst([...brokers.map(brokerLevel), cpuLevel(cpuSamples), memoryLevel(sample.memory)]);

  return {
    cpuSamples,
    lastRawLevel: raw,
    status: {
      level: settle(tracker.status?.level ?? null, tracker.lastRawLevel, raw),
      server: { cpuPct: sample.cpuPct, ...sample.memory },
      brokers,
      at: sample.now.toISOString(),
    },
  };
}
