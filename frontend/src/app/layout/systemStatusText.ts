import type { BrokerStatus, SystemLevel, SystemStatusView } from '../../lib/useSystemStatus';

export interface StatusSummary {
  headline: string;
  closing: string | null;
}

const LEVEL_RANK: Record<SystemLevel, number> = { ok: 0, warn: 1, bad: 2 };
const VISIBLE_WHEN_NORMAL = 3;
const SECONDS_PER_MINUTE = 60;
const MB_PER_GB = 1024;

export const LEVEL_LABEL: Record<SystemLevel, string> = { ok: 'OK', warn: 'Degraded', bad: 'Problem' };

export function formatDuration(seconds: number): string {
  return seconds < SECONDS_PER_MINUTE ? `${seconds} s` : `${Math.floor(seconds / SECONDS_PER_MINUTE)} min`;
}

export function formatFreeMemory(freeMemMb: number): string {
  return `${(freeMemMb / MB_PER_GB).toFixed(1)} GB`;
}

export function brokerStateLabel(broker: BrokerStatus): string {
  switch (broker.state) {
    case 'connected':
      return broker.level === 'ok' ? 'Connected' : 'Connected · ticks delayed';
    case 'loading':
      return broker.loadTotal ? `Loading history · ${broker.loadDone ?? 0} of ${broker.loadTotal}` : 'Loading history';
    case 'restarting':
      return `Restarting · ${formatDuration(broker.disconnectedS ?? 0)}`;
    case 'disconnected':
      return `Disconnected · ${formatDuration(broker.disconnectedS ?? 0)}`;
  }
}

// The brokers that need attention, worst first; with none, a few of the healthy ones.
export function listedBrokers(brokers: BrokerStatus[]): BrokerStatus[] {
  const attention = brokers
    .filter(b => b.level !== 'ok')
    .sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || (b.tickDelayS ?? 0) - (a.tickDelayS ?? 0));
  return attention.length > 0 ? attention : brokers.slice(0, VISIBLE_WHEN_NORMAL);
}

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;
const names = (brokers: BrokerStatus[]): string => brokers.map(b => b.name).join(', ');
const worstDelay = (brokers: BrokerStatus[]): number => Math.max(0, ...brokers.map(b => b.tickDelayS ?? 0));

export function summarize({ status, connectionLost, level }: SystemStatusView): StatusSummary {
  if (connectionLost) {
    return {
      headline: 'Connection to the server lost. What you see may be out of date.',
      closing: 'The app reconnects by itself as soon as the server answers.',
    };
  }
  if (!status) return { headline: 'Waiting for the first status from the server.', closing: null };

  const { brokers, server } = status;
  const disconnected = brokers.filter(b => b.state === 'disconnected');
  const restarting = brokers.filter(b => b.state === 'restarting');
  const loading = brokers.filter(b => b.state === 'loading');
  const delayed = brokers.filter(b => b.state === 'connected' && b.level !== 'ok');

  if (disconnected.length > 0) {
    const [first] = disconnected;
    const headline = disconnected.length === 1
      ? `${first.name} has been disconnected for ${formatDuration(first.disconnectedS ?? 0)}. Its prices and positions are not being updated.`
      : `${plural(disconnected.length, 'broker')} disconnected: ${names(disconnected)}. Their prices and positions are not being updated.`;
    return { headline, closing: 'The server restarts a closed terminal by itself within 5 minutes.' };
  }
  if (restarting.length > 0) {
    return {
      headline: `${plural(restarting.length, 'terminal')} restarting: ${names(restarting)}.`,
      closing: 'Nothing to do: it goes back to green when they reconnect.',
    };
  }
  if (loading.length > 0) {
    const delay = worstDelay(loading);
    const verb = loading.length === 1 ? 'is loading its' : 'are loading their';
    const late = delay > 0 ? ` ${loading.length === 1 ? 'Its' : 'Their'} ticks arrive up to ${formatDuration(delay)} late.` : '';
    return {
      headline: `${plural(loading.length, 'terminal')} ${verb} candle history.${late}`,
      closing: 'Nothing to do: it goes back to green when the loads finish.',
    };
  }
  if (delayed.length > 0) {
    return {
      headline: `Ticks arrive up to ${formatDuration(worstDelay(delayed))} late on ${names(delayed)}.`,
      closing: 'Prices on screen may be behind the market.',
    };
  }
  if (level !== 'ok') {
    const cpu = server.cpuPct === null ? '' : `CPU at ${server.cpuPct} %, `;
    return {
      headline: `The server is under heavy load: ${cpu}${formatFreeMemory(server.freeMemMb)} of memory free.`,
      closing: 'Everything keeps working, but it may respond slowly.',
    };
  }
  return {
    headline: `Everything is normal: ${plural(brokers.length, 'broker')} connected, ticks up to date.`,
    closing: null,
  };
}
