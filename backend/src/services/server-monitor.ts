import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { db } from '../db/client';

// Spec 051: the backend runs on the server it reports on. CPU and memory come from Node
// every 15 s; the Windows-only figures from scripts/server-probe.ps1 every minute (events
// and pm2 restarts every 10 min). One averaged row per minute goes to server_samples.

export const FAST_MS = 15_000;
export const PROBE_MS = 60_000;
export const EVENTS_MS = 10 * 60_000;
export const SAMPLE_MS = 60_000;
export const CLEANUP_MS = 24 * 60 * 60_000;
export const KEEP_MS = 7 * 24 * 60 * 60_000;
const PROBE_TIMEOUT_MS = 20_000;
const PROBE_SCRIPT = path.resolve(__dirname, '../../scripts/server-probe.ps1');

export interface CpuTimes { idle: number; total: number }

export interface ProbeService { name: string; state: string }
export interface ProbeTerminal { broker: string; running: boolean; memMb: number | null }
export interface ServerEvent { at: string; kind: 'bugcheck' | 'unexpected'; code: string | null; param1: string | null }

export interface ProbeResult {
  host: string;
  os: string;
  bootAt: string;
  pageFileMb: number | null;
  diskFreeGb: number;
  diskTotalGb: number;
  services: ProbeService[];
  terminals: ProbeTerminal[];
  events?: ServerEvent[];
  backendRestarts?: number | null;
}

export interface ServerSnapshot {
  cores: number;
  memTotalMb: number;
  memUsedMb: number;
  cpu: number | null;
  fastAt: Date | null;
  probe: ProbeResult | null;
  probeAt: Date | null;
  events: ServerEvent[] | null;
  backendRestarts: number | null;
}

export const cpuTimes = (cpus: os.CpuInfo[]): CpuTimes =>
  cpus.reduce((acc, c) => {
    const t = c.times;
    return { idle: acc.idle + t.idle, total: acc.total + t.user + t.nice + t.sys + t.idle + t.irq };
  }, { idle: 0, total: 0 });

// Share of the time between two readings that was not idle, across all cores.
export function cpuPercent(prev: CpuTimes, curr: CpuTimes): number | null {
  const total = curr.total - prev.total;
  if (total <= 0) return null;
  return Math.round((1 - (curr.idle - prev.idle) / total) * 1000) / 10;
}

export const average = (values: number[]): number | null =>
  values.length === 0 ? null : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

// The probe's JSON, or null when it is not the expected shape. PowerShell turns a
// single-element array into a bare object, so lists are normalised here.
export function parseProbe(raw: string): ProbeResult | null {
  let data: unknown;
  try { data = JSON.parse(raw.trim()); } catch { return null; }
  if (!isObject(data) || typeof data['host'] !== 'string' || typeof data['bootAt'] !== 'string') return null;
  const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
  const result: ProbeResult = {
    host: data['host'],
    os: String(data['os'] ?? ''),
    bootAt: data['bootAt'],
    pageFileMb: typeof data['pageFileMb'] === 'number' ? data['pageFileMb'] : null,
    diskFreeGb: Number(data['diskFreeGb'] ?? 0),
    diskTotalGb: Number(data['diskTotalGb'] ?? 0),
    services: list(data['services']).filter(isObject).map((s) => ({ name: String(s['name']), state: String(s['state']) })),
    terminals: list(data['terminals']).filter(isObject).map((t) => ({
      broker: String(t['broker']),
      running: t['running'] === true,
      memMb: typeof t['memMb'] === 'number' ? t['memMb'] : null,
    })),
  };
  if ('events' in data) {
    result.events = list(data['events']).filter(isObject).map((e) => ({
      at: String(e['at']),
      kind: e['kind'] === 'bugcheck' ? 'bugcheck' : 'unexpected',
      code: typeof e['code'] === 'string' ? e['code'] : null,
      param1: typeof e['param1'] === 'string' ? e['param1'] : null,
    }));
  }
  if ('backendRestarts' in data) result.backendRestarts = typeof data['backendRestarts'] === 'number' ? data['backendRestarts'] : null;
  return result;
}

export type ProbeRunner = (events: boolean) => Promise<string>;

export const runProbeScript = (brokersFile: string): ProbeRunner => (events) =>
  new Promise((resolve, reject) => {
    const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PROBE_SCRIPT, '-BrokersFile', brokersFile];
    if (events) args.push('-Events');
    execFile('powershell.exe', args, { timeout: PROBE_TIMEOUT_MS, windowsHide: true }, (err, stdout) => {
      if (err) reject(err); else resolve(stdout);
    });
  });

export interface MonitorDeps {
  runProbe: ProbeRunner;
  readCpus: () => os.CpuInfo[];
  memory: () => { total: number; free: number };
  now: () => Date;
  save: (row: { time: Date; cpu: number; memUsedMb: number; memTotalMb: number; pageFileMb: number | null; terminals: number | null }) => Promise<unknown>;
  prune: (before: Date) => Promise<unknown>;
}

const defaultDeps = (brokersFile: string): MonitorDeps => ({
  runProbe: runProbeScript(brokersFile),
  readCpus: () => os.cpus(),
  memory: () => ({ total: os.totalmem(), free: os.freemem() }),
  now: () => new Date(),
  save: (row) => db.serverSample.create({ data: row }),
  prune: (before) => db.serverSample.deleteMany({ where: { time: { lt: before } } }),
});

const MB = 1024 * 1024;

export class ServerMonitor {
  private prevCpu: CpuTimes;
  private minuteCpu: number[] = [];
  private timers: NodeJS.Timeout[] = [];
  private state: ServerSnapshot;

  constructor(private deps: MonitorDeps) {
    this.prevCpu = cpuTimes(deps.readCpus());
    const mem = deps.memory();
    this.state = {
      cores: deps.readCpus().length,
      memTotalMb: Math.round(mem.total / MB),
      memUsedMb: Math.round((mem.total - mem.free) / MB),
      cpu: null, fastAt: null, probe: null, probeAt: null, events: null, backendRestarts: null,
    };
  }

  snapshot(): ServerSnapshot {
    return { ...this.state };
  }

  sampleFast(): void {
    const curr = cpuTimes(this.deps.readCpus());
    const cpu = cpuPercent(this.prevCpu, curr);
    this.prevCpu = curr;
    const mem = this.deps.memory();
    this.state.memTotalMb = Math.round(mem.total / MB);
    this.state.memUsedMb = Math.round((mem.total - mem.free) / MB);
    this.state.fastAt = this.deps.now();
    if (cpu !== null) { this.state.cpu = cpu; this.minuteCpu.push(cpu); }
  }

  // A failed or malformed probe keeps the previous figures; probeAt tells how old they are.
  async probe(events: boolean): Promise<void> {
    try {
      const result = parseProbe(await this.deps.runProbe(events));
      if (!result) { console.error('[MONITOR] probe returned an unexpected output'); return; }
      this.state.probe = result;
      this.state.probeAt = this.deps.now();
      if (result.events) this.state.events = result.events;
      if (result.backendRestarts !== undefined) this.state.backendRestarts = result.backendRestarts;
    } catch (err) {
      console.error('[MONITOR] probe failed:', err instanceof Error ? err.message : err);
    }
  }

  async saveMinute(): Promise<void> {
    const cpu = average(this.minuteCpu) ?? this.state.cpu;
    this.minuteCpu = [];
    if (cpu === null) return;
    const probe = this.state.probe;
    try {
      await this.deps.save({
        time: this.deps.now(),
        cpu,
        memUsedMb: this.state.memUsedMb,
        memTotalMb: this.state.memTotalMb,
        pageFileMb: probe?.pageFileMb ?? null,
        terminals: probe ? probe.terminals.filter((t) => t.running).length : null,
      });
    } catch (err) {
      console.error('[MONITOR] sample not saved:', err instanceof Error ? err.message : err);
    }
  }

  async prune(): Promise<void> {
    try {
      await this.deps.prune(new Date(this.deps.now().getTime() - KEEP_MS));
    } catch (err) {
      console.error('[MONITOR] cleanup failed:', err instanceof Error ? err.message : err);
    }
  }

  start(): void {
    this.sampleFast();
    void this.probe(true);
    void this.prune();
    this.timers.push(
      setInterval(() => this.sampleFast(), FAST_MS),
      setInterval(() => void this.probe(false), PROBE_MS),
      setInterval(() => void this.probe(true), EVENTS_MS),
      setInterval(() => void this.saveMinute(), SAMPLE_MS),
      setInterval(() => void this.prune(), CLEANUP_MS),
    );
  }

  stop(): void {
    this.timers.forEach(clearInterval);
    this.timers = [];
  }
}

let monitor: ServerMonitor | null = null;

export function startServerMonitor(brokersFile: string): ServerMonitor {
  monitor = new ServerMonitor(defaultDeps(brokersFile));
  monitor.start();
  return monitor;
}

export const serverMonitor = (): ServerMonitor | null => monitor;
