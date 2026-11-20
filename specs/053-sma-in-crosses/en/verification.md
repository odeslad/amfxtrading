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

## Task 5 · [backend] Overlay average types in `/settings`

- **Mechanism:** lint + typecheck + test + build.
- **Steps:** `EmaTradesSettings` gains `fastType`/`slowType` (optional on input, default ema; equal periods only rejected for the same type), read from and written to `emaTradesFastType`/`emaTradesSlowType`; tests for the types, the default and the equal-period rule.
- **Outcome:** ✅ 207 tests green (flaky `pipe-reader` again passed on rerun), typecheck, build and lint clean.
- **Est vs Actual:** 0.25 SP · 0.25 SP.

## Task 6 · [frontend] Average types in the cross alerts panel

- **Mechanism:** `npm run build` + eslint; local check (Vite 5174 against the production API).
- **Steps:** shared `MaTypeToggle` (EMA | SMA); `useEmaAlerts` carries `fastType`/`slowType`; `AlertsPanel` has a toggle before each period, threshold on its own row, tab "MA cross", list rows labelled with `maLabel` ("EMA 24 / SMA 48 ≤2p").
- **Outcome:** ✅ build and lint clean; the operator created an EMA 24 / SMA 48 alert on FTMO EURUSD H1 and saw it listed with the right label.
- **Est vs Actual:** 1.25 SP · 0.5 SP.

## Task 7 · [frontend] Average types in the notification rules

- **Mechanism:** `npm run build` + eslint; local check (Vite 5174 against the production API).
- **Steps:** `useEmaNotifications` carries `fastType`/`slowType` and adds `averagesLabel`; `NotificationPanel` has a `MaTypeToggle` before each period; the table (column "Averages"), the phone cards and the delete confirmation show "SMA 20 / EMA 48". Also fixed a pre-existing layout bug seen while testing: the panel's fields stretched over the whole height (shared `.field { flex: 1 }`); the panel now keeps them at their own height without touching the journal panel.
- **Outcome:** ✅ build and lint clean; the operator checked the form and the layout fix.
- **Est vs Actual:** 1 SP · 0.5 SP.

## Task 8 · [frontend] Average types in the cross trades overlay

- **Mechanism:** `npm run build` + eslint; local check (Vite 5174 against the production API).
- **Steps:** `EmaTradesSettings` carries `fastType`/`slowType` (default ema); Settings › Display shows a `MaTypeToggle` before the fast and slow periods; `useEmaCrossTrades` sends the types to `/setup-levels` and refetches when they change.
- **Outcome:** ✅ build and lint clean; the operator checked the overlay with an SMA side and back to EMA.
- **Est vs Actual:** 0.75 SP · 0.5 SP.
