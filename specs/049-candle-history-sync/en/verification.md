# 049 — Candle history sync from Settings · Verification

## Task 1 · [ea] Spike: history download on the Demo terminal

- **Mechanism:** manual, throwaway script `SyncSpike049` dropped by the operator on the Demo terminal (2026-11-18).
- **Runs:**
  1. `ChartOpen` + `ChartNavigate(CHART_BEGIN)`: EURUSD M5 2 621 → 2 621, D1 2 050 → 2 050; charts closed. No download.
  2. Same plus the Home key (`PostMessageW`): stopped by "DLL is not allowed" (the script needs *Allow DLL imports*).
  3. Home key with DLL allowed: M5 10 341 → 10 341, D1 2 875 → 2 875. The bars before the run came from the operator scrolling by hand with the left arrow.
  4. Chart brought to front + PageUp, Home and Left keys, 30 s patience: the charts visibly scroll back, but M5 24 869 → 24 869 and later 33 950 → 33 950 (again loaded by hand before each run).
- **Outcome:** inconclusive as a script — every growth came from manual scrolling, so the broker does serve more history but a script blocking in `Sleep` did not get it. Decision of the operator: implement it exactly as spec 044 did (archive commit `a86b7fb`), where the same terminal went from 2 065 to 65 425 bars on EURUSD M15: the EA, on each timer tick, opens the temporary chart, `ChartNavigate(CHART_BEGIN)` + Home by `PostMessageW` to `CHART_WINDOW_HANDLE`, returns, and decides on the next ticks (wait while `ERR_HISTORY_UPDATING` or new bars keep arriving; give up after a quiet period or a maximum per chart). Proof moves to task 6 on the Demo terminal.
- **Note:** the script always probed its `SPIKE_SYMBOL` input (EURUSD), whatever chart it was dropped on (GBPCHF, USDCNH); this was not explained to the operator. EURUSD M5 grew between runs 3 → 4 → 5 (10 341 → 24 869 → 33 950) while the operator worked on other charts: the blocks the keys requested arrived after the script had given up, which points to a wait too short, not to a wrong method.
- **Design impact:** `HttpBridgeCommands` needs `user32.dll` (`PostMessageW`), so *Allow DLL imports* must be on for that EA too (it already is for `HttpBridgeState`, which uses `kernel32.dll` for the pipe).
- Spike files removed from the Demo terminal.
- **Est vs Actual:** 1 SP · 1 SP.

## Task 2 · [db] Migration: legacy table, new candles table, candle_syncs

- **Mechanism:** `prisma validate` + `prisma generate` + `npm run build` + lint + typecheck; `prisma migrate diff` from the production schema (read through an SSH tunnel, nothing written) to the new datamodel.
- **Steps:** migration `20261118000000_candle_sync`: `candles` renamed to `candles_legacy` (and `candles_pkey` to `candles_legacy_pkey`), new empty `candles` with the same columns and key, new `candle_syncs` (key broker + timeframe, `target` 10 000 by default, `state` `idle` by default). Prisma models `CandleLegacy` and `CandleSync`.
- **Outcome:** ✅ schema valid, client generated, build, lint and typecheck clean. The diff from production to the datamodel is exactly `candles_legacy` (same columns and key as today's `candles`) plus `candle_syncs`, with `candles` unchanged — the end state of the migration. `prisma migrate status` on production: only this migration pending (not applied; it runs with the backend deploy). The rename is a catalogue change only: it does not read the damaged pages. No local PostgreSQL credentials were available, so the migration was not run on a scratch database.
- **Est vs Actual:** 0.75 SP · 0.5 SP.

## Task 3 · [backend] Legacy or new table per broker and timeframe

- **Mechanism:** vitest + lint + typecheck + build.
- **Steps:** `services/candle-store.ts`: in-memory set of migrated pairs loaded at start from `candle_syncs` (`lastSyncAt` set), `markMigrated`, `candleTable(broker, timeframe)` → `db.candle` or `db.candleLegacy`, `storedSymbols` (DISTINCT of both tables). Found while implementing: besides the watcher, the rollover and `GET /candles`, three more readers use candles — the EMA alert evaluator, the EMA notification evaluator and `GET /setup-levels` — plus `GET /symbols`; all go through the store (design updated).
- **Outcome:** ✅ 5 new tests (unsynced pair → legacy; marked pair → new, only that pair; pairs loaded at start; reload forgets; symbols of both tables, once each, sorted); full suite 18 files / 151 tests; lint, typecheck and build clean. With no pair migrated the backend reads and writes `candles_legacy`, the same rows as today.
- **Est vs Actual:** 1.5 SP · 0.75 SP.

## Task 4 · [backend] Routes /candle-sync

- **Mechanism:** vitest (router mounted on a throwaway Express server, `fetch` against it; DB, config and liveness mocked) + lint + typecheck + build.
- **Steps:** `routes/candle-sync.ts` mounted at `/candle-sync` behind `requireAuth`: `GET /` (creates missing rows with target 10 000; every broker with `connected` and its five timeframes in M5 → D1 order), `PUT /targets` (100 … 50 000), `POST /` (404 unknown broker, 503 EA not connected, 409 a sync queued or running, otherwise rows → `queued` with a new `requestId` and `sync-command.json` written, 202). `bridge/sync-io.ts`: `writeSyncCommand` (temp + rename) and `withdrawSyncCommand` for task 5.
- **Outcome:** ✅ 10 new tests (target range, unknown timeframe, empty list; timeframes deduplicated and ordered; POST queues and writes the command with each target; 409 and 503 write nothing; 404; GET order and connection; PUT stores the target); full suite 19 files / 161 tests; lint, typecheck and build clean.
- **Est vs Actual:** 1.5 SP · 0.75 SP.
