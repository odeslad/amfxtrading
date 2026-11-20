# 053 — SMA in crosses · Verification

## Task 1 · [db] Average type columns

- **Mechanism:** `prisma validate` + `prisma generate` + `npm run build`; `prisma migrate diff` from production.
- **Steps:** migration `20261120000000_moving_average_types` adds `fastType`/`slowType` (`ema_cross_alerts`, `ema_notifications`) and `emaTradesFastType`/`emaTradesSlowType` (`settings_display`), all `TEXT NOT NULL DEFAULT 'ema'`; matching fields in `schema.prisma`.
- **Outcome:** ✅ schema valid, client generated, build green; the diff from production is exactly the six columns of the migration.
- **Est vs Actual:** 0.5 SP · 0.25 SP.

## Task 2 · [backend] SMA and the average helper

- **Mechanism:** vitest + build + lint.
- **Steps:** `indicators/sma.ts` (`calculateSma`, same rolling sum as the chart's `calcSma`); `indicators/moving-average.ts` (`MA_TYPES`, `isMaType`, `calculateMa`, `maLabel`); `moving-average.test.ts`.
- **Outcome:** ✅ 17 indicator tests green, build and lint clean.
- **Est vs Actual:** 0.5 SP · 0.25 SP.

## Task 3 · [backend] Crosses and setup levels with types

- **Mechanism:** vitest + build + lint.
- **Steps:** `ema-cross.ts` takes optional `fastType`/`slowType` (default ema) and uses `calculateMa`; `/setup-levels` accepts `fastType`/`slowType` (400 if not ema|sma; equal periods allowed when the types differ); new test with an SMA slow side.
- **Outcome:** ✅ 207 tests green, build and lint clean.
- **Est vs Actual:** 0.75 SP · 0.25 SP.

## Task 4 · [backend] Alerts and notifications with types

- **Mechanism:** lint + typecheck + test + build.
- **Steps:** `/ema-alerts` and `/ema-notifications` accept and validate `fastType`/`slowType` (ema|sma, default ema; equal periods only rejected for the same type); stores load the types; evaluators use `calculateMa`; pushes read "EMA 24 / SMA 50" (alert title "MA cross"); the WS notification payload carries the types.
- **Outcome:** ✅ 207 tests green (the known flaky `pipe-reader` test failed once and passed on rerun), typecheck, build and lint clean.
- **Est vs Actual:** 1.5 SP · 0.5 SP.
