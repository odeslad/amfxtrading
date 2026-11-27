# 063 — Split layouts

> Status: **closed**

## Context
The chart's split view (spec 036, unlinked charts since spec 060) is set up by hand every time: the broker, pair and timeframe of each chart. The operator uses two or three recurring set-ups. This spec stores them as named split layouts, edited in Settings and applied from a button on the chart that opens a side panel on the right, like the other chart panels.

## Affected layers
- db · backend · frontend

## User stories
- As a trader, I want to save a few named split layouts (broker, pair and timeframe of each chart), so that I do not rebuild them by hand.
- As a trader, I want to apply one from a button on the chart, so that I switch between my usual set-ups in one click.

## Acceptance criteria
- AC 1. WHEN the user opens Settings › Display THEN a "Split layouts" section lists their layouts and lets them create, rename, edit and delete one.
- AC 2. WHEN a layout is created or edited THEN it holds a name and, for the left and the right chart, a broker, a pair and a timeframe.
- AC 3. WHEN the chart is shown on desktop THEN a split layouts button is always visible in the chart toolbar; on mobile, where the split view does not exist, it is not shown.
- AC 4. WHEN the user presses the button THEN a side panel opens on the right, like the other chart panels, listing the layouts; with none, it says so and points to Settings › Display.
- AC 5. WHEN the user picks a layout THEN both charts take its brokers, pairs and timeframes, the width between the charts stays as it is, and the split opens if it was closed.
- AC 6. WHEN a layout uses the same broker and pair on both sides THEN the charts are applied linked; otherwise unlinked.
- AC 7. WHEN what the charts show matches a layout THEN the panel marks it as active.
- AC 8. WHEN a layout uses a broker hidden from the frontend or a pair turned off for its broker THEN the panel marks it with a warning and it cannot be applied.
- AC 9. WHEN layouts change in Settings THEN an open chart page shows the change without a reload, also in other tabs and devices of the same user.
- AC 10. WHEN the user signs in on another device THEN they see the same layouts (stored per user in the database).

## Out of scope
- Saving the current view as a layout from the chart panel.
- Layouts for the single chart view.
- Keyboard shortcuts.
- The width between the charts.
- Drawings, indicators or moving average templates in a layout.
