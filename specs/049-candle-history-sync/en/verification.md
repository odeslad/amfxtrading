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

## Task 5 · [backend] Sync watcher

- **Mechanism:** vitest with fixture files in a temp bridge folder (DB and candle store mocked) + lint + typecheck + build.
- **Steps:** `bridge/sync-watcher.ts`: one `SyncWatcher` per broker (started with the file watcher), polls `sync-status.json` every second and handles a status only when it changes and belongs to a current request. `running` → row `running` with "SYMBOL done/total"; `complete` → reads `sync/<SYM>_<TF>.json` of that timeframe and, in one transaction (10 min timeout), deletes the pair from the new table, inserts the candles in chunks and sets `done`, `candleCount` (fewest candles of any symbol), `detail` and `lastSyncAt`; then marks the pair migrated and deletes its files. `error` / `finished` with timeframes still busy → `error`. Stall guard: 5 min without change → `sync-command.json` withdrawn, rows `error`. WS `candle_sync` `{ broker, timeframe, state, detail, candleCount, lastSyncAt, done?, total? }` (`ws.broadcastCandleSync`).
- **Outcome:** ✅ 8 new tests (status parsing; running progress; complete → one transaction, 16 212 rows from two symbols, `candleCount` 6 212, pair migrated, only the files of that timeframe removed; failed transaction → error, not migrated, previous count kept; no files → error, nothing deleted; EA error → every busy timeframe in error; old or repeated status ignored; stall → command withdrawn and error); full suite 20 files / 169 tests; lint, typecheck and build clean.
- **Noted:** candles that close between the EA writing the sync files and the swap go to the legacy table (the pair is not migrated yet); the regular candle file of the EA (last 100 bars every 60 s) writes them into the new table within a minute of the swap, so no hole is left.
- **Est vs Actual:** 2.5 SP · 1 SP.

## Task 6 · [ea] HttpBridgeCommands 2.23: candle sync

- **Mechanism:** MetaEditor compile on the server (scratch folder `C:\backup\ea049`, `compile-ea.ps1`) + manual run on the Demo terminal (2026-11-18). A local backend cannot read the bridge files of the server, so the assistant played the backend over SSH: wrote `sync-command.json`, read `sync-status.json` and the files, and took the files of each finished timeframe (kept in `C:\backup\ea049\sync-<TF>`).
- **Steps:** `HttpBridgeCommands` 2.23 reads `symbols` from `config.json` (input `SYMBOLS` as fallback); after `command.json`, one sync step per 1 s timer tick: a symbol already holding the target is exported at once, otherwise a temporary chart is taken to its beginning with `ChartNavigate` + Home by `PostMessageW` (method of spec 044) until enough bars, or quiet 5 s (no bars yet) / 12 s (bars arrived) without `ERR_HISTORY_UPDATING`, or 120 s; chart closed; newest `min(target, bars - 1)` closed bars written to `sync/<SYM>_<TF>.json` (temp + move). After the last symbol: `complete`, then waits until the backend has taken the files (max 900 s) before the next timeframe; at the end `finished`. Errors and an EA stop write `error`. Compiled with 0 errors, 0 warnings; the previous `.ex4` of Demo kept as `HttpBridgeCommands.prev.ex4`.
- **Run (Demo, 15 symbols, H4 target 10 000 + D1 target 3 000):** the operator re-attached the EA with *Allow DLL imports*; log `v2.23 | broker: Demo | symbols: 15 | ready`. Command taken within 5 s; H4 15/15 in about 6 minutes (≈ 25 s per symbol) with temporary charts opening and closing on their own; the EA waited on `complete` until the H4 files were taken, then moved to D1; D1 15/15, then `finished`. No chart left open (operator).
- **Files:** every file sorted ascending and ending at the last closed bar (H4 12:00, D1 17 Nov; the forming bar excluded). H4: EURUSD, GBPUSD, USDJPY 10 000 (target), the other 12 symbols 7 008 (from May 2022, the broker cap — the same depth spec 044 measured). D1: 2 049–2 874 (2015–2018 onwards), below the 3 000 target because that is all the broker holds.
- **Pending for task 10:** an order sent during a sync (the backend was not deployed for this run).
- **Est vs Actual:** 2.5 SP · 1.5 SP.

## Task 7 · [frontend] Settings tab Data

- **Mechanism:** `npm run build` + `npm run lint`. The local check planned in the task is not possible: the new tables only exist once the backend is deployed and the EAs only run on the server (a local backend sees every broker as not connected), so the visual check moves to the production validation of task 10.
- **Steps:** `lib/useCandleSync.ts` (loads `GET /candle-sync` when the tab opens, applies `candle_sync` WS messages, keeps unsaved targets, saves them per broker with `PUT /candle-sync/targets` after checking 100 … 50 000, starts a sync with `POST /candle-sync` and shows it queued at once, errors as toasts). `features/settings/DataSyncTab.tsx` + `.module.css` as in the approved mockup: one block per broker with a top border by state (green idle, orange syncing, red last error, grey EA not connected), status dot (pulsing gold while syncing), header state text, *Sync selected (n)* / *Retry · Sync selected* / *Sync in progress*; desktop table (checkbox, TF, candles in DB, target input without spinners, last sync, state with progress bar), mobile rows of 56 px with 44 px button; a broker whose EA is not connected shows only its header. `SettingsPage`: new tab *Data*, *Save targets* and "Unsaved targets" in the tab bar.
- **Outcome:** ✅ build and lint clean.
- **Est vs Actual:** 3 SP · 1 SP.
