import { snapshot } from './liveness';
import { cpuPercent, readCpuTimes, readMemory, type CpuTimes } from '../services/server-load';
import { emptyTracker, nextStatus, type StatusTracker, type SystemStatus } from '../services/system-status';

let tracker: StatusTracker = emptyTracker();
let hiddenBrokers: readonly string[] = [];
let lastCpuTimes: CpuTimes | null = null;

export function setHiddenBrokers(brokers: readonly string[]): void {
  hiddenBrokers = [...brokers];
}

// One sample of the whole system; the caller sets the pace (THRESHOLDS.sampleS).
export function sampleSystemStatus(now = new Date()): SystemStatus {
  const cpuTimes = readCpuTimes();
  const cpuPct = lastCpuTimes ? cpuPercent(lastCpuTimes, cpuTimes) : null;
  lastCpuTimes = cpuTimes;
  tracker = nextStatus(tracker, { now, brokers: snapshot(), hiddenBrokers, cpuPct, memory: readMemory() });
  return tracker.status as SystemStatus;
}

export function currentSystemStatus(): SystemStatus {
  return tracker.status ?? sampleSystemStatus();
}

export function resetSystemStatus(): void {
  tracker = emptyTracker();
  hiddenBrokers = [];
  lastCpuTimes = null;
}
