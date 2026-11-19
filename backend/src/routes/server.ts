import { Router } from 'express';
import { db } from '../db/client';
import { config } from '../config';
import { asyncRoute } from '../middleware/asyncRoute';
import { BadRequest, HttpError } from '../middleware/errors';
import { singleQuery } from '../middleware/parse';
import { snapshot as livenessSnapshot } from '../store/liveness';
import { serverMonitor, type ServerEvent, type ServerSnapshot } from '../services/server-monitor';

// Spec 051: Settings › Server.

export type HistoryRange = '24h' | '7d';

export interface HistoryPoint { t: string; cpu: number; memUsedMb: number; pageFileMb: number | null }

const RANGE_MS: Record<HistoryRange, number> = { '24h': 24 * 60 * 60_000, '7d': 7 * 24 * 60 * 60_000 };

// Event 41 is written while Windows starts again, so the one that explains the last
// boot lies within a few minutes after it.
const BOOT_EVENT_WINDOW_MS = 15 * 60_000;

export function parseRange(value: string | undefined): HistoryRange {
  const range = value ?? '24h';
  if (range !== '24h' && range !== '7d') throw new BadRequest('range must be 24h or 7d');
  return range;
}

export function lastBootAfterCrash(bootAt: string, events: ServerEvent[] | null): boolean {
  const boot = Date.parse(bootAt);
  return (events ?? []).some((e) => {
    const at = Date.parse(e.at);
    return at >= boot - 60_000 && at <= boot + BOOT_EVENT_WINDOW_MS;
  });
}

const ageS = (now: Date, at: Date | null): number | null =>
  at ? Math.max(0, Math.round((now.getTime() - at.getTime()) / 1000)) : null;

export function serverReport(now: Date, s: ServerSnapshot) {
  const probe = s.probe;
  const live = livenessSnapshot();
  const terminals = config.brokers.map(({ name }) => {
    const t = probe?.terminals.find((x) => x.broker === name);
    const l = live.get(name);
    return {
      broker: name,
      running: t ? t.running : null,
      memMb: t?.memMb ?? null,
      pipe: l?.pipe ?? null,
      tickAgeS: ageS(now, l?.lastTickAt ?? null),
    };
  });
  return {
    host: probe?.host ?? null,
    os: probe?.os ?? null,
    cores: s.cores,
    memTotalMb: s.memTotalMb,
    bootAt: probe?.bootAt ?? null,
    uptimeS: probe ? ageS(now, new Date(probe.bootAt)) : null,
    lastBootAfterCrash: probe ? lastBootAfterCrash(probe.bootAt, s.events) : false,
    cpu: s.cpu,
    memUsedMb: s.memUsedMb,
    pageFileMb: probe?.pageFileMb ?? null,
    diskFreeGb: probe?.diskFreeGb ?? null,
    diskTotalGb: probe?.diskTotalGb ?? null,
    services: probe?.services ?? [],
    backend: {
      uptimeS: Math.round(process.uptime()),
      rssMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
      restarts: s.backendRestarts,
    },
    terminals,
    events: s.events,
    sampledAt: s.fastAt?.toISOString() ?? null,
    staleS: ageS(now, s.probeAt),
  };
}

// 24h: the minute rows as stored. 7d: 10-minute averages, so the chart stays near 1 000 points.
export async function history(range: HistoryRange, now: Date): Promise<HistoryPoint[]> {
  const since = new Date(now.getTime() - RANGE_MS[range]);
  if (range === '24h') {
    const rows = await db.serverSample.findMany({
      where: { time: { gte: since } },
      orderBy: { time: 'asc' },
      select: { time: true, cpu: true, memUsedMb: true, pageFileMb: true },
    });
    return rows.map((r) => ({ t: r.time.toISOString(), cpu: r.cpu, memUsedMb: r.memUsedMb, pageFileMb: r.pageFileMb }));
  }
  const rows = await db.$queryRaw<{ t: Date; cpu: number; memUsedMb: number; pageFileMb: number | null }[]>`
    SELECT date_bin('10 minutes', "time", TIMESTAMP '2000-01-01') AS t,
           round(avg("cpu")::numeric, 1)::float8 AS cpu,
           round(avg("memUsedMb"))::int AS "memUsedMb",
           round(avg("pageFileMb"))::int AS "pageFileMb"
    FROM "server_samples"
    WHERE "time" >= ${since}
    GROUP BY 1
    ORDER BY 1`;
  return rows.map((r) => ({ t: r.t.toISOString(), cpu: r.cpu, memUsedMb: r.memUsedMb, pageFileMb: r.pageFileMb }));
}

export interface Gap { from: string; to: string }

// Samples are written every 60 s ± 1 s: more than 90 s between two means at least one
// minute was not recorded (backend or server down). Read from the minute rows, so even the
// 7-day chart, which averages them into 10-minute buckets, can mark short restarts.
export const GAP_S = 90;

export async function gaps(range: HistoryRange, now: Date): Promise<Gap[]> {
  const since = new Date(now.getTime() - RANGE_MS[range]);
  const rows = await db.$queryRaw<{ from: Date; to: Date }[]>`
    SELECT prev AS "from", "time" AS "to"
    FROM (SELECT "time", lag("time") OVER (ORDER BY "time") AS prev FROM "server_samples" WHERE "time" >= ${since}) s
    WHERE prev IS NOT NULL AND "time" - prev > make_interval(secs => ${GAP_S})
    ORDER BY "time"`;
  return rows.map((r) => ({ from: r.from.toISOString(), to: r.to.toISOString() }));
}

const router = Router();

const requireMonitor = () => {
  const monitor = serverMonitor();
  if (!monitor) throw new HttpError(503, 'The server monitor is off on this backend');
  return monitor;
};

router.get('/', (_req, res) => {
  res.json(serverReport(new Date(), requireMonitor().snapshot()));
});

router.get('/history', asyncRoute(async (req, res) => {
  const range = parseRange(singleQuery(req.query, 'range'));
  res.json(await history(range, new Date()));
}));

router.get('/gaps', asyncRoute(async (req, res) => {
  const range = parseRange(singleQuery(req.query, 'range'));
  res.json(await gaps(range, new Date()));
}));

export default router;
