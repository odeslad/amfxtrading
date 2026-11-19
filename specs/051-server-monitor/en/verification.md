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
