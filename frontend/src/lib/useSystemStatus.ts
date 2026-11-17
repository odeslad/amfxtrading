import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from './api';
import { useWs } from './useWs';

export type SystemLevel = 'ok' | 'warn' | 'bad';
export type BrokerState = 'connected' | 'loading' | 'restarting' | 'disconnected';

export interface BrokerStatus {
  name: string;
  state: BrokerState;
  level: SystemLevel;
  tickDelayS: number | null;
  loadDone?: number;
  loadTotal?: number;
  disconnectedS?: number;
}

export interface SystemStatus {
  level: SystemLevel;
  server: { cpuPct: number | null; freeMemMb: number; totalMemMb: number };
  brokers: BrokerStatus[];
  at: string;
}

export interface SystemStatusView {
  // Null until the first status arrives.
  level: SystemLevel | null;
  status: SystemStatus | null;
  // The backend stopped talking: decided here, it cannot report it itself.
  connectionLost: boolean;
  receivedAt: number | null;
}

interface SystemMessage extends SystemStatus {
  type: string;
}

// The backend sends one every 5 s: four missed in a row means the connection is gone.
const SILENCE_MS = 20_000;

export function useSystemStatus(): SystemStatusView {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [receivedAt, setReceivedAt] = useState<number | null>(null);
  const [connectionLost, setConnectionLost] = useState(false);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const armSilenceTimer = useCallback(() => {
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    silenceTimer.current = setTimeout(() => setConnectionLost(true), SILENCE_MS);
  }, []);

  const accept = useCallback((next: SystemStatus) => {
    setStatus(next);
    setReceivedAt(Date.now());
    setConnectionLost(false);
    armSilenceTimer();
  }, [armSilenceTimer]);

  useEffect(() => {
    let cancelled = false;
    armSilenceTimer();
    apiFetch<SystemStatus>('/status')
      .then(first => { if (!cancelled && first) accept(first); })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
    };
  }, [accept, armSilenceTimer]);

  useWs(useCallback((data: unknown) => {
    const message = data as SystemMessage;
    if (message.type !== 'system') return;
    accept({ level: message.level, server: message.server, brokers: message.brokers, at: message.at });
  }, [accept]));

  return {
    level: connectionLost ? 'bad' : status?.level ?? null,
    status,
    connectionLost,
    receivedAt,
  };
}
