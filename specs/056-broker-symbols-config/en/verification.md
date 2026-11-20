# 056 — Broker symbols from the frontend · Verification

## Task 1 · [backend] Broker symbol files

- **Mechanism:** lint + typecheck + test + build.
- **Steps:** `services/broker-symbols.ts`: `isTrackedPair` (crosses of AUD, EUR, NZD, USD, CAD, GBP, JPY by the first six letters, suffix allowed), `readAvailable` (`symbols-available.json`, BOM tolerated, null until reported, unique and sorted), `readActive` (`config.json` comma list), `writeActive` (keeps every other field, `.tmp` + rename, `BrokerSymbolsError` for a missing folder or an unreadable file); tests on a temporary folder.
- **Outcome:** ✅ 4 tests green, typecheck, build and lint clean.
- **Est vs Actual:** 1.5 SP · 0.5 SP.
