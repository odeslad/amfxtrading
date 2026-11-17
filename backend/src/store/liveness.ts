export type PipeState = 'listening' | 'connected' | 'error' | 'disabled';

export interface EaStatus {
  version: string;
  loading: boolean;
  loadDone: number;
  loadTotal: number;
}

export interface BrokerLiveness {
  pipe: PipeState;
  pipeLostAt: Date | null;
  eaStatus: EaStatus | null;
  lastTickAt: Date | null;
  lastSyncAt: Date | null;
  watcher: boolean;
}

export interface BrokerHealth {
  name: string;
  pipe: PipeState;
  lastTickAt: string | null;
  lastSyncAt: string | null;
  tickAgeS: number | null;
  syncAgeS: number | null;
}

export interface HealthReport {
  status: 'ok' | 'degraded';
  uptimeS: number;
  brokers: BrokerHealth[];
}

const STALE_TICK_MS = 5 * 60_000;

const state = new Map<string, BrokerLiveness>();

export function register(broker: string, features: { pipe: boolean; watcher: boolean }, at = new Date()): void {
  state.set(broker, {
    pipe: features.pipe ? 'listening' : 'disabled',
    pipeLostAt: features.pipe ? at : null,
    eaStatus: null,
    lastTickAt: null,
    lastSyncAt: null,
    watcher: features.watcher,
  });
}

// The pipe counts as lost from the moment it stops being connected until an EA
// holds it again; what the previous EA said about itself dies with it.
export function setPipeState(broker: string, pipe: PipeState, at = new Date()): void {
  const entry = state.get(broker);
  if (!entry) return;
  entry.pipe = pipe;
  if (isPipeLive(pipe)) {
    entry.pipeLostAt = null;
    return;
  }
  entry.pipeLostAt ??= at;
  entry.eaStatus = null;
}

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

export function parseEaStatus(raw: unknown): EaStatus | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { version, loading, loadDone, loadTotal } = raw as Record<string, unknown>;
  if (typeof version !== 'string' || typeof loading !== 'boolean') return null;
  if (!isCount(loadDone) || !isCount(loadTotal) || loadDone > loadTotal) return null;
  return { version, loading, loadDone, loadTotal };
}

export function setEaStatus(broker: string, status: EaStatus): void {
  const entry = state.get(broker);
  if (entry) entry.eaStatus = status;
}

export function touchTick(broker: string, at = new Date()): void {
  const entry = state.get(broker);
  if (entry) entry.lastTickAt = at;
}

export function touchSync(broker: string, at = new Date()): void {
  const entry = state.get(broker);
  if (entry) entry.lastSyncAt = at;
}

export function pipeStateOf(broker: string): PipeState | null {
  return state.get(broker)?.pipe ?? null;
}

// A disabled pipe (local development) counts as live: nothing is expected from it.
export function isPipeLive(pipe: PipeState): boolean {
  return pipe === 'connected' || pipe === 'disabled';
}

export function snapshot(): Map<string, BrokerLiveness> {
  return new Map([...state].map(([name, entry]) => [name, { ...entry, eaStatus: entry.eaStatus && { ...entry.eaStatus } }]));
}

const ageS = (now: Date, at: Date | null): number | null =>
  at ? Math.max(0, Math.round((now.getTime() - at.getTime()) / 1000)) : null;

// A broker is live when its EA holds the pipe and sent something in the last
// 5 min; a disabled pipe (local development) is not a failure.
export function healthReport(now: Date, startedAt: Date, brokers: Map<string, BrokerLiveness>): HealthReport {
  const entries: BrokerHealth[] = [...brokers].map(([name, b]) => ({
    name,
    pipe: b.pipe,
    lastTickAt: b.lastTickAt?.toISOString() ?? null,
    lastSyncAt: b.lastSyncAt?.toISOString() ?? null,
    tickAgeS: ageS(now, b.lastTickAt),
    syncAgeS: ageS(now, b.lastSyncAt),
  }));
  const degraded = entries.some(b =>
    b.pipe !== 'disabled' && (b.pipe !== 'connected' || b.tickAgeS === null || b.tickAgeS * 1000 > STALE_TICK_MS),
  );
  return {
    status: degraded ? 'degraded' : 'ok',
    uptimeS: ageS(now, startedAt) ?? 0,
    brokers: entries,
  };
}
