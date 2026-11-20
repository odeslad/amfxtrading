# 053 — SMA in crosses · Design

## Approach
Each side of a cross gets a type next to its period: `fastType` / `slowType`, `'ema' | 'sma'`, default `'ema'`. One helper, `calculateMa(candles, type, period)`, replaces the direct `calculateEma` calls in every evaluator. Table and route names (`ema_cross_alerts`, `/ema-alerts`, …) stay: renaming them is churn with no benefit.

## Per layer
### db
One migration adding `TEXT NOT NULL DEFAULT 'ema'` columns:
- `ema_cross_alerts.fastType`, `slowType`
- `ema_notifications.fastType`, `slowType`
- `settings_display.emaTradesFastType`, `emaTradesSlowType`

Existing rows become EMA/EMA by the default (AC 7). No backfill.

### backend
- `indicators/sma.ts` — `calculateSma` (same `(number|null)[]` shape as `calculateEma`, null until `period` candles), and `indicators/moving-average.ts` with `calculateMa`. Tests next to them.
- `indicators/ema-cross.ts` — `EmaCrossContext` gains `fastType`, `slowType` (optional, default ema). The `EMA` setup level keeps its name: it is the slow average's value.
- `alerts/ema-alert-evaluator.ts`, `ema-notification-evaluator.ts` — use `calculateMa`; push titles/bodies use `maLabel` → "EMA 24 / SMA 50". Warm-up count unchanged (`max(period)+2`; an SMA needs fewer candles than an EMA).
- `routes/ema-alerts.ts`, `ema-notifications.ts` — accept and validate `fastType`/`slowType` (optional, `ema|sma`, 400 otherwise); keep the "different periods" rule only when both types match (EMA 20 / SMA 20 is a valid cross).
- `routes/setup-levels.ts` — optional `fastType`/`slowType` query params, default ema.
- `routes/settings.ts` — the two overlay fields, validated the same way.

The API stays backwards compatible: clients that do not send types get EMA. No EA contract change.

### frontend
- Shared `MaTypeToggle` (EMA | SMA segmented control) placed before each period input (mockup).
- `AlertsPanel`, `NotificationPanel`, `DisplayTab` (overlay section): the toggle per side; lists, the delete confirmation and the notifications table show "EMA 24 / SMA 50" with `maLabel` from `movingAverages.ts`.
- `useEmaAlerts`, `useEmaNotifications`, `useEmaTradesSettings`, `useEmaCrossTrades` carry the types; the overlay passes them to `/setup-levels`.
- `NewTradePanel` keeps EMA 24/48 (not asked for).

## Data flow
Frontend → REST (types in body/query) → BD → evaluators at candle close → WS `ema_alert` / push with the labels. Nothing changes in EA ↔ backend.

## Alternatives
- One `averages` JSON column instead of two type columns: more flexible but loses easy validation and querying. Rejected.
- Rename tables to `ma_*`: cleaner names, but a risky migration and wide churn. Rejected.

## Risks
- SMA and EMA values must match the chart: the backend `calculateSma` mirrors the frontend `calcSma` (simple average of the last `period` closes); covered by a test with the same series.

## Mockup
https://claude.ai/artifact/VBvyuXQesrLvCMuex1jG1y — artboards: Chart › Alerts (desktop), Settings › Notifications, Settings › Display overlay, Alerts (mobile).
