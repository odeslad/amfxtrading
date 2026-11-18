# 049 — Candle history sync from Settings · Design

## Approach (option A, chosen by the operator)
The damaged pages live in the file of the current `candles` table; deleting and inserting rows does not repair them, and rebuilding the table needs a full read, which is what fails. So the migration **sets the current table aside as `candles_legacy`** and creates a **new, empty `candles`**. Each manual sync fills one broker and timeframe in the new table. Until a pair is synced it keeps reading and writing the legacy table exactly as today, so no chart goes empty. When every pair is synced the legacy table is dropped and the damage is gone (AC 11).

## Data flow
```
Settings › Data ──POST /candle-sync──▶ backend ──bridge/sync-command.json──▶ EA (HttpBridgeCommands)
                                                                           │ per step: one symbol × timeframe
                                                                           │ (temporary chart if history is short)
                                       backend ◀──bridge/sync-status.json──┤ progress
                                       backend ◀──bridge/sync/<SYM>_<TF>.json (candles)
     WS candle_sync ◀── backend: when a timeframe is complete → one transaction: delete pair in new table + insert files
```

## Database (`[db]`)
- Migration: `ALTER TABLE candles RENAME TO candles_legacy` (and its primary key), then `CREATE TABLE candles` with the same columns and key. Prisma: `Candle` keeps `@@map("candles")`; new model `CandleLegacy` → `candles_legacy`.
- New table `candle_syncs` (model `CandleSync`), key `(broker, timeframe)`: `target Int` · `candleCount Int?` · `lastSyncAt DateTime?` · `state` (`idle` | `queued` | `running` | `done` | `error`) · `detail String?` (symbol in progress or error reason) · `requestId String?` · `updatedAt`.
  Default targets when a row is first created: 10 000 for every timeframe, so a first sync is quick (changeable in Settings between 100 and 50 000).
- A pair is **migrated** when its `lastSyncAt` is not null.
- Last task: `DROP TABLE candles_legacy` once every pair is migrated, then a full `pg_dump` must succeed.

## Backend (`[backend]`)
- `services/candle-store.ts`: `tableFor(broker, timeframe)` → new or legacy, from an in-memory cache of migrated pairs (loaded at start, updated at the end of each sync). `upsertCandles` (watcher), `persistClosedCandle` (tick rollover), `GET /candles`, the EMA alert and EMA notification evaluators and `GET /setup-levels` go through it; `GET /symbols` lists the symbols of both tables. Unmigrated pairs behave exactly as today.
- `routes/candle-sync.ts` (`requireAuth`):
  - `GET /candle-sync` → every broker × M5/M15/H1/H4/D1 with `target`, `candleCount`, `lastSyncAt`, `state`, `detail`. Missing rows are created with the default target. `candleCount` is stored at the end of a sync, never counted live (counting the legacy table is what crashed PostgreSQL).
  - `PUT /candle-sync/targets` `{ broker, targets: { M5?: n, … } }` → 400 outside 100 … 50 000 (range set by the operator).
  - `POST /candle-sync` `{ broker, timeframes[] }` → 409 if that broker has a sync queued or running (AC 9); 503 if its pipe is not connected (AC 8); otherwise rows → `queued`, writes `bridge/sync-command.json` (temp + rename) `{ id, timeframes: [{ tf, target }] }`, 202.
- `bridge/sync-watcher.ts` (one per broker, every 1 s): reads `sync-status.json` `{ id, state, timeframe, symbol, done, total, message }` → updates the row and broadcasts. When the EA reports a timeframe `complete`: reads the `sync/<SYM>_<TF>.json` files of that timeframe and, **in one transaction**, deletes the pair from the new table and inserts every closed candle (chunks), then sets `candleCount` (the count of the symbol with the fewest candles, so it reads as the depth every symbol reached), `detail` ("N symbols · total candles"), `lastSyncAt`, `state = done`, marks the pair migrated and deletes the files. Any failure → rollback, `state = error` with the reason: nothing is deleted (AC 8).
- Stall guard: no status change for 5 min while `running` → `error` "EA stopped answering"; `sync-command.json` withdrawn if still there.
- WS: new message `candle_sync` `{ broker, timeframe, state, detail, candleCount, lastSyncAt, done, total }` to every client (AC 7).
- Day-to-day saving keeps running during a sync: candles inserted by the watcher or the rollover while the transaction runs use `skipDuplicates`, so nothing is lost or duplicated (AC 10).

## EA (`[ea]`, `HttpBridgeCommands` 2.23)
- Reads `symbols` from `config.json` like `HttpBridgeState` (same list).
- Its 1 s timer checks `sync-command.json` **after** `command.json`, so an order never waits for a sync. Work is done **one symbol × timeframe per timer tick** (AC 10):
  1. If `iBars(sym, tf) < target`: `ChartOpen(sym, tf)` and, one step per timer tick, `ChartNavigate(CHART_BEGIN)` plus the Home key sent with `PostMessageW` to the chart window (the method of spec 044, commit `a86b7fb`; `ChartNavigate` alone downloads nothing, task 1), until `iBars ≥ target`, or no new bars and no `ERR_HISTORY_UPDATING` for a quiet period, or a maximum time per chart; `ChartClose` (AC 4). Needs `user32.dll`: *Allow DLL imports* on for this EA.
  2. Write `sync/<SYM>_<TF>.json` with the newest `min(target, iBars)` **closed** bars (same fields and `brokerOffset` as the candle files).
  3. Write `sync-status.json` (`running`, symbol, done/total). After the last symbol of a timeframe: `complete` for that timeframe; after the last timeframe: `finished`.
- Errors (chart cannot open, file cannot be written) → `sync-status.json` `error` with the message.
- **Contract:** additive only — new files `sync-command.json`, `sync-status.json` and folder `sync/`; existing files and the pipe do not change. An EA without 2.23 never answers: the stall guard turns the sync into an error and nothing is deleted.

## Frontend (`[frontend]`)
- New Settings tab **Data** (`DataSyncTab.tsx` + `.module.css`): one block per broker (hidden brokers included), one row per timeframe: checkbox · TF · candles in DB · target (number input, no spinners) · last sync · state. Per broker: **Sync selected** button (disabled while that broker syncs or nothing is marked); targets saved with the page's Save button.
- State live from the `candle_sync` WS message; on open, `GET /candle-sync` (AC 7, also on another device).
- Desktop table, mobile cards (project pattern).

## Mockup
Approved by the operator on 2026-11-18: https://claude.ai/artifact/8Fjvb5F4h8cHGvnkkkEKDt

- **Desktop · Settings › Data**: tab bar with the new DATA tab and *Save targets*; one block per broker showing every state — DEMO idle with two rows marked and partial results ("broker has 6 212 of 10 000"), FTMO syncing (done / running with symbol and progress bar / queued; controls locked), DARWINEX error ("EA stopped answering", nothing deleted), SOLIDARY ISA EA not connected.
- **Mobile · Settings › Data**: the same states as one card per broker, rows of 56 px, 44 px buttons (*Sync selected*, *Save targets*, *Retry*).

## Operator prerequisite
MT4 caps bars per chart in *Tools › Options › Charts › Max bars in chart*. In every terminal it must be ≥ 50 000 (the maximum target), or the sync stops at that cap (the row then shows the real number reached, AC 6). Set it once by RDP before the first sync.

## Risks
- **History download by `ChartNavigate`**: not proved yet that MT4 fetches older bars this way → the first EA task is a spike on the Demo terminal before writing the rest.
- **Long transaction** for M5 × 15 symbols × 50 000 bars at most (~750 000 rows; ~150 000 with the default 10 000): chunks with the existing `chunks()` helper; measured in the spike; if too slow, insert per symbol into a staging table and swap in one short transaction at the end (still nothing deleted on failure).
- **EA start writes every bar** (`999999`) of every timeframe: after a restart a migrated pair may hold more than its target. Accepted (day-to-day saving is out of scope); the count shown is the one stored at the end of the sync.
- **Disk**: the legacy table stays until the end (2.1 GB) next to the new one; ~70 GB free on the server.

## Files
- `backend/prisma/schema.prisma`, `backend/prisma/migrations/<ts>_candle_sync/migration.sql`
- `backend/src/services/candle-store.ts` (new), `services/candles.ts`, `services/candle-close.ts`, `routes/candles.ts`, `routes/candle-sync.ts` (new), `bridge/sync-watcher.ts` (new), `ws/ws.ts`, `index.ts`, `app.ts`
- `frontend/src/features/settings/SettingsPage.tsx`, `DataSyncTab.tsx` + `.module.css` (new), WS client types
- `ea/HttpBridgeCommands.mq4`
- `.claude/CLAUDE.md` and `backend/docs/architecture.md` (new router, WS message, bridge files)
