# 053 — SMA in crosses, notifications, overlay and setup levels

> Status: **closed**
> Parent: [052 — Moving average templates](../../052-moving-average-templates/en/requirements.md)

## Context
Spec 052 added simple moving averages (SMA) to the chart, but everything that evaluates a cross still works only with EMAs: cross alerts (`ema_cross_alerts`), standing notification rules (`ema_notifications`), the cross trades overlay (`settings_display.emaTrades*`) and the setup levels (`/setup-levels`). The operator wants the same capabilities with SMAs.

## Affected layers
- db · backend · frontend

## User stories
- As the operator, I want each side of a cross (fast and slow) to be an EMA or an SMA, so that I can alert on, be notified of and study crosses of the averages I actually draw.

## Acceptance criteria
- AC 1. WHEN I create or edit a cross alert THEN I choose the type (EMA/SMA) of the fast and of the slow average, independently.
- AC 2. WHEN I create or edit a notification rule (Settings › Notifications) THEN I choose both types the same way.
- AC 3. WHEN an alert or rule uses an SMA THEN it is evaluated at candle close with the SMA value, with the same cross/approach/threshold/direction logic as with EMAs.
- AC 4. WHEN an alert or rule fires THEN the push and the in-app text name the types (e.g. "SMA 20 / EMA 50").
- AC 5. WHEN I configure the cross trades overlay in Settings › Display THEN I choose the type of each average, and the overlay computes crosses with them.
- AC 6. WHEN the setup levels are requested THEN each average can be EMA or SMA, and the result matches the chart.
- AC 7. WHEN the spec is deployed THEN every existing alert, rule, overlay setting and setup level keeps working unchanged as EMA against EMA.
- AC 8. Periods keep the same rule as today (integer ≥ 1).

## Out of scope
- Other average types (WMA, etc.).
- Linking alerts or the overlay to the chart's moving average templates.
- The Settings reorganisation (future spec).
