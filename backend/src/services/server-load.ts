import os from 'os';

export interface CpuTimes {
  idle: number;
  total: number;
}

export interface ServerMemory {
  freeMemMb: number;
  totalMemMb: number;
}

const BYTES_PER_MB = 1024 * 1024;

// os.cpus() counts milliseconds since boot per core: a load figure only exists
// between two readings.
export function readCpuTimes(): CpuTimes {
  return os.cpus().reduce<CpuTimes>((sum, cpu) => {
    const { user, nice, sys, idle, irq } = cpu.times;
    return { idle: sum.idle + idle, total: sum.total + user + nice + sys + idle + irq };
  }, { idle: 0, total: 0 });
}

export function cpuPercent(previous: CpuTimes, current: CpuTimes): number | null {
  const total = current.total - previous.total;
  if (total <= 0) return null;
  const busy = total - (current.idle - previous.idle);
  return Math.min(100, Math.max(0, Math.round((busy / total) * 100)));
}

export function readMemory(): ServerMemory {
  return {
    freeMemMb: Math.round(os.freemem() / BYTES_PER_MB),
    totalMemMb: Math.round(os.totalmem() / BYTES_PER_MB),
  };
}
