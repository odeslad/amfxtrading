# 051 — Server monitor in Settings · Verification

## Task 1 · [db] Table server_samples

- **Mechanism:** `prisma validate` + `prisma generate` + `npm run build`; `prisma migrate diff` from the production schema (read through the SSH tunnel to the XL+, nothing written) to the new datamodel.
- **Steps:** migration `20261119000000_server_samples` (`time` timestamp PK, `cpu` real, `memUsedMb` and `memTotalMb` int, `pageFileMb` int null, `terminals` smallint null); Prisma model `ServerSample`.
- **Outcome:** ✅ schema valid, client generated, build clean. The diff from production to the datamodel is exactly the `CREATE TABLE "server_samples"` of the migration, so it is empty once the migration runs with the backend deploy.
- **Est vs Actual:** 0.5 SP · 0.25 SP.

## Task 2 · [backend] Probe script and server monitor service

- **Mechanism:** vitest + lint + typecheck + build; the probe run by hand on the XL+.
- **Steps:** `backend/scripts/server-probe.ps1` (read-only; brokers mapped to terminals as in `startup.ps1`; event 41 of 30 days → `bugcheck` with code and first parameter, or `unexpected` when the code is 0; pm2 restart count read from `pm2 jlist` with a regular expression, because PowerShell 5.1's `ConvertFrom-Json` rejects pm2's env, which holds `Path` and `PATH`). `src/services/server-monitor.ts`: CPU % from `os.cpus()` deltas and memory every 15 s, probe every 60 s, events and restarts every 10 min, one row a minute with the average CPU of its fast samples, cleanup of rows older than 7 days at start and daily; a failed or malformed probe keeps the previous figures. Started in `index.ts` behind `FEATURE_SERVER_MONITOR` (in `.env.example`); `config.brokersFile` added.
- **Probe on the XL+ (2026-11-19):** plain run 548 ms, with `-Events` 1 181–1 248 ms (under the 2 s of the task), exit 0, valid JSON: host, OS, last boot 10:31:59 UTC, page file 1 064 MB, C: 448.9 of 479.4 GB free, the 4 services `running`, the 13 brokers with their terminal running and 23–32 MB each, 0 events (the XL+ has not crashed; its only restart was the clean reboot test), `backendRestarts` 1.
- **Tests:** 14 new in `server-monitor.test.ts` (CPU % over all cores, nothing when no time passed, average, probe parsing incl. PowerShell's single-object lists and foreign output, minute row with averaged CPU and probe figures, no row before the first reading, previous probe kept on failure, events only from an events run, 7-day cleanup cutoff, database error survived). Full suite 180 tests green; lint, typecheck and build clean.
- **Outcome:** ✅
- **Est vs Actual:** 3 SP · 1.5 SP.

## Task 3 · [backend] Routes /server

- **Mechanism:** vitest on a throwaway Express server with `requireAuth` and a real JWT cookie + lint + typecheck + build; the 7-day query run on the production PostgreSQL 17 over the SSH tunnel with inline rows (nothing written).
- **Steps:** `src/routes/server.ts`, mounted in `app.ts` as `/server` behind `requireAuth`. `GET /server` joins the monitor snapshot with every broker of `brokers.json` (terminal running and memory from the probe, pipe and tick age from `store/liveness`); `lastBootAfterCrash` when an event 41 lies between 1 min before and 15 min after the last boot; `staleS` = age of the last probe; `503` when the monitor is off. `GET /server/history?range=24h|7d`: 24h the minute rows, 7d `date_bin('10 minutes')` averages in SQL; another range `400`.
- **SQL check:** three inline rows at 12:01, 12:07 and 12:12 → buckets 12:00 (CPU 15, memory 3 050, page file 900 — the null ignored) and 12:10 (30, 3 200, 950).
- **Tests:** 9 new in `server.test.ts` (range parsing, crash-boot window, 401 without session on both routes, 503 with the monitor off, the joined report, the report before the first probe, 24h rows and their cut-off, 7d bucketing query, 400 for another range). A first run failed in the full suite on an exact tick age (the suite is slower than the file alone); the assertion now checks a bound. Full suite 189 tests green; lint, typecheck and build clean.
- **Outcome:** ✅
- **Est vs Actual:** 1.5 SP · 0.75 SP.

## Backend deploy (part of task 7, done early so history builds up)

- **2026-11-19:** commits `8b2a10c`…`c7b9d05` pushed alone (only `backend/` and `specs/`); backend pipeline green. On the XL+: migration `20261119000000_server_samples` applied; one row a minute since 13:46:40 UTC (memory total 16 374 MB, 13 terminals); no `[MONITOR]` errors in the pm2 log.
- **CPU check:** the monitor showed 27–29 % where the morning's Windows counter had shown 13 %. Both measured together: Windows `% Processor Time` 31.9 % and `% Processor Utility` 32.2 % over 30 s, monitor rows 26.4–27.6 % — the monitor is right; the 13 terminals had gone from 11.6 % to 22 % (market hours), the backend with the monitor 0.8 %.
- **Lesson for the local check:** a local backend with the monitor on writes its own PC's samples into the production table through the DB tunnel. It was stopped within the first minute; every row since the deploy has the XL+'s 16 374 MB total and the exact 60 s rhythm, so none came from the PC. Local checks of the tab use Vite proxied to the production API instead (`DEV_API_TARGET=https://api.amfxtrading.com`).

## Task 4 · [frontend] Server tab

- **Mechanism:** `npm run build` + eslint; local check at `https://local.amfxtrading.com:5174` with Vite proxied to the production API (real XL+ figures, nothing written).
- **Steps:** `src/lib/useServerStatus.ts` (polls `/server` every 15 s and the history every minute while the tab is open; keeps the last report when a poll fails; history held per range). `src/features/settings/ServerTab.tsx` + `.module.css`: machine header with a status dot and the crash badge, four gauges (green < 70 %, gold < 90 %, red), services and backend, terminals sorted problems first (stopped, running without fresh ticks, healthy, no ticks), table on desktop and cards at ≤ 768 px, crashes list, collapsible sections remembered in `localStorage` (`amfx.server.collapsed`), loading and out-of-date states. `Server` tab in `SettingsPage`. React's lint rules forbid `Date.now()` in render and a synchronous `setState` in an effect: the hook exposes the time of the last poll and keys the history by range.
- **Operator check (2026-11-19):** `WIN-5SSFL41HHDI`, Windows Server 2025, 8 cores, 16 GB; last boot 19 Nov 11:31 local, uptime 3 h 31 m; CPU 28.1 %, memory 3.1 / 16 GB, page file 1.0 GB, disk 449 / 479 GB; services 4 / 4; backend 17 m, 183 MB, 0 restarts (pm2's counter restarts with each deploy, which deletes and recreates the process); terminals 13 / 13, 12 connected at 0 s and `solidary isa` last in grey as "no ticks"; crashes "None in the last 30 days".
- **Outcome:** ✅
- **Est vs Actual:** 3 SP · 1.5 SP.

## Task 5 · [frontend] Charts

- **Mechanism:** `npm run build` + eslint; local check with Vite proxied to the production API.
- **Steps:** `ServerCharts.tsx` + `.module.css` with `lightweight-charts` (already a dependency): CPU % on the left scale (0–100), memory and page file in GB on the right, local hours; a missing stretch longer than 2.5 samples becomes a whitespace point, so the line breaks instead of joining; crashes and unexpected shutdowns of the report's event list drawn over the chart as an HTML layer placed with `timeToCoordinate` (red or amber line where the samples stop, hatched gap up to the first sample after it, dashed green line at the restart, label with kind, code, time and minutes down), re-placed on resize; 24H / 7D switch; loading and "No samples yet" states. Shown as the first collapsible section of the tab. Added at the operator's request: a grip under the chart resizes it (140–600 px, keyboard arrows too), remembered per device.
- **Operator check (2026-11-19):** chart with CPU, memory and page file since the backend deploy at 14:46 local; the resize grip works.
- **Not seen yet:** a real gap and a crash marker — the history has no hole since the deploy and the XL+ has not crashed. The gap is checked in task 7 after the next backend restart; a crash marker can only be seen if one happens.
- **Outcome:** ✅ (gap pending in task 7)
- **Est vs Actual:** 2 SP · 1 SP.

## Task 6 · [docs] Project guidelines and backend architecture

- **Mechanism:** manual — both documents agree.
- **Steps:** `backend/docs/architecture.md`: `FEATURE_SERVER_MONITOR` in the flags paragraph and the environment table (with the warning about a local backend), `scripts/server-probe.ps1` and `services/server-monitor.ts` in the project tree, router `/server`, section "Server monitor (spec 051)", table `server_samples`, and the local run (flag off; Vite proxied to the production API to look at the tab). `.claude/CLAUDE.md`: section "Monitor del servidor (spec 051)", 19 routers with `/server`, model `ServerSample`, the flag.
- **Outcome:** ✅ both describe the same collectors, intervals, table, retention, routes and flag.
- **Est vs Actual:** 0.5 SP · 0.25 SP.
