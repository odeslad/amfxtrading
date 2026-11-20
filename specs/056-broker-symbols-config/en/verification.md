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
