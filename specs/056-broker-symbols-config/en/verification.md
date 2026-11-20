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
