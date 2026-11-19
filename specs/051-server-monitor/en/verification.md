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
