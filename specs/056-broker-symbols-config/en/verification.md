# 056 — Broker symbols from the frontend · Verification

## Task 1 · [backend] Broker symbol files

- **Mechanism:** lint + typecheck + test + build.
- **Steps:** `services/broker-symbols.ts`: `isTrackedPair` (crosses of AUD, EUR, NZD, USD, CAD, GBP, JPY by the first six letters, suffix allowed), `readAvailable` (`symbols-available.json`, BOM tolerated, null until reported, unique and sorted), `readActive` (`config.json` comma list), `writeActive` (keeps every other field, `.tmp` + rename, `BrokerSymbolsError` for a missing folder or an unreadable file); tests on a temporary folder.
- **Outcome:** ✅ 4 tests green, typecheck, build and lint clean.
- **Est vs Actual:** 1.5 SP · 0.5 SP.

## Task 2 · [backend] `/broker-symbols` routes

- **Mechanism:** lint + typecheck + test + build.
- **Steps:** `routes/broker-symbols.ts` (under `requireAuth`): `GET` returns `{ broker, available, active }` for every broker of `brokers.json`; `PUT /:broker { symbols }` validates the list (400), rejects symbols the broker does not offer (400) and turning off symbols with open positions or orders (409, `openSymbols` from the positions store), writes `config.json` (a write failure is a clear 409), broadcasts `broker_symbols` over WS and hands the newly turned-on symbols to a handler (wired in task 3); `parseSymbols` and `planChange` tested.
- **Outcome:** ✅ 223 tests green, typecheck, build and lint clean.
- **Est vs Actual:** 1.5 SP · 0.5 SP.

## Task 3 · [backend] History sync of turned-on pairs

- **Mechanism:** lint + typecheck + test + build.
- **Steps:** `SyncCommand.symbols` (optional); `syncNewSymbols` in `routes/candle-sync.ts` waits for the first tick of every new pair (2 min), for any sync in progress to end (30 min) and for the pipe, then marks the broker's rows queued and writes `sync-command.json` with every Data timeframe at its target and `symbols`; wired from `PUT /broker-symbols` in `index.ts` (outcome logged). `sync-watcher` now replaces only the delivered symbols of a timeframe, so a one-pair sync leaves the rest alone and a turned-off pair keeps its candles (AC 11). Tests for the command, the three give-up cases and the scoped delete.
- **Outcome:** ✅ full suite green, typecheck, build and lint clean.
- **Est vs Actual:** 2 SP · 0.75 SP.

## Task 4 · [backend] Rollout of the hidden symbols

- **Mechanism:** lint + typecheck + test + build.
- **Steps:** `services/hidden-symbols-rollout.ts`: `planRollout` (pure: per broker, hidden pairs to remove from the active list, matching a broker suffix; pairs with open positions kept on; brokers whose positions are not known yet left for later) and `rollOutHiddenSymbols` (writes each `config.json`, logs every change, keeps only the pending brokers in `hiddenSymbols`); started from `index.ts` when the watcher feature is on, first run 1 min after start, retried every 10 min while something is pending. `/settings` no longer stores an incoming `hiddenSymbols` (old clients). Deviation from the design: the rollout waits for each broker's positions instead of running at the very start, since the positions store is empty until the EA streams.
- **Outcome:** ✅ full suite green, typecheck, build and lint clean.
- **Est vs Actual:** 1 SP · 0.5 SP.

## Task 5 · [ea] Broker symbol list, live config and one-pair sync

- **Mechanism:** compiled by the EA pipeline on deploy; manual check on one terminal (task 9).
- **Steps:** `HttpBridgeState` 3.16: `SelectSymbols` (Market Watch), `WriteAvailableSymbols` (`symbols-available.json` with `SymbolsTotal(false)` names, at start and when the count changes, checked every 60 s), `ReloadConfigIfChanged` every 5 s by `config.json` modification time (`FileGetInteger`, `FILE_MODIFY_DATE`), keeping the pipe broker name. `HttpBridgeCommands` 2.24: the same config reload every 5 s; `ExtractStringArray` reads `symbols` from `sync-command.json` and the sync walks that list (else every streamed symbol). Found while writing it: an empty `symbols` makes the EA fall back to its built-in input list, so the backend now refuses to save an empty list ("Keep at least one pair on", separate backend fix).
- **Outcome:** 🕐 pending the pipeline compile and the terminal check.
- **Est vs Actual:** 3 SP · 1 SP (code).

## Task 6 · [frontend] Visibility follows the streamed pairs

- **Mechanism:** `npm run build` + eslint; local check against production.
- **Steps:** `lib/visibility.ts`: `activeSymbols` loaded from `GET /broker-symbols` with `/settings`, `isSymbolVisible` = in the broker's active list (case-insensitive; a broker without a list shows everything), `setBrokerSymbols` for the `broker_symbols` WS message (wired in `AppLayout`), `publishVisibility` keeps the active lists when Settings saves; `hiddenSymbols` no longer filters.
- **Outcome:** ✅ build and lint clean; the operator checked that solidary and solidary II only list EURUSD and FTMO / darwinex keep their 15 pairs.
- **Est vs Actual:** 1 SP · 0.4 SP.
