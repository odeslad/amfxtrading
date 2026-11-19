# 051 — Server monitor in Settings · Design

## Approach

The backend runs on the server it reports on, so it collects the figures itself — no agent, no new process. Two collectors with different costs:

| Collector | Every | Source | Figures |
|---|---|---|---|
| fast | 15 s | Node `os` (no child process) | CPU % (delta of `os.cpus()` times), memory used / total, uptime |
| slow | 60 s | one PowerShell run of a script shipped in the repo (`backend/scripts/server-probe.ps1`), JSON on stdout | page-file use, free disk on C:, services (`postgresql-x64-17`, `nginx`, `Cloudflared`, `sshd`), terminal processes (executable path, working set), last boot time, host name, Windows version |
| events | 10 min | same script with `-Events` | events 41, 1001 and 6008 of the System log in the last 30 days (time, kind, bugcheck code and first parameter) |

A PowerShell start costs about 0.3–0.5 s of one core; once a minute that is under 0.1 % of the 8 cores (AC 9). Windows-only data comes from PowerShell because Node has no API for services, the event log or the page file; `os` covers the rest without a child process.

Each fast sample is kept in memory (the current snapshot); once a minute the backend writes one row to the history table with the average CPU of the last four fast samples, memory used, page-file use and the number of terminals running. A daily job deletes rows older than 7 days (AC 8): the charts go back 7 days at most; the crash list keeps 30 days because it comes from the Windows event log, not from these rows.

Terminals per broker: the slow probe returns the running `terminal.exe` paths; the backend maps each broker to its executable the same way `infra/scripts/startup.ps1` does (`bridgePath` → data folder → `origin.txt` → `terminal.exe`), resolved once at start. Pipe state and tick age come from `store/liveness`, as `/health` does. Backend process figures come from Node (`process.uptime()`, `process.memoryUsage().rss`) and the restart count from pm2's environment (`restart_time` is not in the env; the count is read from `pm2 jlist` in the slow probe — one more line of the script).

### Alternatives considered

| | Chosen: backend collects | Separate collector (scheduled task writing to the DB) | Read `RAM-Log` CSV |
|---|---|---|---|
| Moving parts | none new | another script, task and DB access to keep alive | depends on a server task outside the repo |
| Live figures | yes (15 s) | only as fresh as its schedule | 1 min |
| Survives a backend crash | history gap while the backend is down | keeps logging | keeps logging |

The gap while the backend is down is acceptable: the event list (from the Windows log, not from our samples) still shows crashes, and `RAM-Log` keeps its own CSV on the server.

## Per-layer changes

### db

New table `server_samples`: `time` (timestamptz, PK), `cpu` (real, %), `memUsedMb` (int), `memTotalMb` (int), `pageFileMb` (int), `terminals` (smallint). Hand-written migration; ~10 000 rows (7 days).

### backend

- `backend/scripts/server-probe.ps1` — prints one JSON object; `-Events` adds the event list. Read-only queries.
- `src/services/server-monitor.ts` — starts both collectors, holds the current snapshot, writes the minute row, runs the daily cleanup, maps brokers to terminals. Started in `index.ts` behind a new flag `FEATURE_SERVER_MONITOR` (off only with the literal `false`, like the others; off for a local backend so it does not report the developer's PC). Errors of a probe are logged and leave the previous values marked stale; they never stop the backend.
- `src/routes/server.ts` (behind `requireAuth`, AC 10):
  - `GET /server` → `{ host, os, cores, memTotalMb, bootAt, uptimeS, lastBootAfterCrash, cpu, memUsedMb, pageFileMb, diskFreeGb, diskTotalGb, services: [{ name, state }], backend: { uptimeS, rssMb, restarts }, terminals: [{ broker, running, memMb, pipe, tickAgeS }], events: [{ at, kind: 'bugcheck'|'unexpected', code?, param1? }], sampledAt, staleS }`.
  - `GET /server/history?range=24h|7d` → `[{ t, cpu, memUsedMb, pageFileMb }]`; 24h returns the minute rows (≤ 1 440), 7d averages them into 10-minute buckets (≤ 1 008) in SQL.
- No WebSocket: the tab polls `GET /server` every 15 s while open (AC 2); nothing is pushed to other clients.

### frontend

- `src/lib/useServerStatus.ts` — polls `/server` every 15 s while the tab is active; loads `/server/history` on open and on range change, and appends a point each minute.
- `src/features/settings/ServerTab.tsx` + `.module.css` — sections as in the mockup: machine header (host, OS, cores, last boot with a crash badge), four gauges (CPU, memory, page file, disk), services and backend, terminals (table on desktop, cards on mobile), CPU/memory charts with a 24h / 7d switch (`lightweight-charts`, already a dependency, a line series per figure; gaps where samples are missing), events list.
- `SettingsPage.tsx` — new `server` tab.

## Data flow

```
Node os (15 s) ─┐
server-probe.ps1 (60 s / 10 min) ─┼─▶ services/server-monitor.ts ──▶ snapshot (memory) ──▶ GET /server ──▶ ServerTab (poll 15 s)
store/liveness (pipes, ticks) ────┘            └──▶ server_samples (1/min, 7 days) ──▶ GET /server/history ──▶ charts
```

## Mockup

Approved by the operator on 2026-11-19: https://claude.ai/artifact/UZjr1LBNPQeXd5JL6d7TzS — artboards: desktop (a terminal down, last boot after a crash), mobile, loading / figures out of date. Decisions taken on the canvas:

- **Crash in the charts**: a red line at the crash time with a label (kind, code, time, minutes down), the gap hatched, a dashed green line at the next start; series end with a dot before the gap and start again after it, never joined across it. An unexpected shutdown without a code is drawn the same in amber.
- **Terminals**: all brokers always listed (no "… more"), problems first — stopped (red), then running without fresh ticks (amber), then healthy, then brokers without an EA (grey).
- **Collapsible sections**: charts, services and backend, terminals and crashes each have a collapse button in their header; collapsed, the header keeps a one-line summary (`12 / 13 running`, `4 / 4 running`, `2 events`). The state is remembered per device (`localStorage`).
- **Resizable chart** (asked by the operator during task 5, after the mockup was approved): a grip under the chart drags its height between 140 and 600 px (default 220; arrow keys move it 20 px), remembered per device.

## Files to touch

- `backend/prisma/schema.prisma`, `backend/prisma/migrations/<ts>_server_samples/migration.sql`
- `backend/scripts/server-probe.ps1`, `backend/src/services/server-monitor.ts` (+ test), `backend/src/routes/server.ts` (+ test), `backend/src/app.ts`, `backend/src/index.ts`, `backend/src/config.ts`, `backend/.env.example`
- `frontend/src/lib/useServerStatus.ts`, `frontend/src/features/settings/ServerTab.tsx`, `ServerTab.module.css`, `SettingsPage.tsx`
- `backend/docs/architecture.md`, `.claude/CLAUDE.md`

## Dependencies

None added.

## Risks

- **PowerShell start-up on the server**: measured during implementation; if a probe takes more than a few seconds, the slow interval is raised, never the fast one.
- **Event log access**: the backend runs under `Administrator` (pm2 in the autologon session), which can read the System log; if not, the event list shows "not available" and the rest works.
- **CPU % from `os.cpus()`** includes all processes (it is the machine's CPU), which is what is wanted.
- **The backend's own downtime** leaves holes in the history; shown as gaps, not interpolated.
