# 059 — Chart zoom memory

> Status: **approved**

## Context

Every time the chart loads a broker, pair or timeframe it resets the zoom: 6 px per candle with the latest candle at 30 % from the right edge, and the price scale on automatic (`LightweightChart.tsx`, history load). Opening a position or order from the journal, switching timeframe or coming back to the chart therefore loses the zoom the operator had set. The timeframe itself is already remembered (`chart.selection` in the browser), and since `fix(frontend)` of 2026-11-21 the journal no longer forces H1.

## Affected layers

- frontend

## User stories

- As an operator, I want each timeframe to keep the horizontal zoom I last used, so that M5 and D1 open the way I like to read them.
- As an operator, I want a pair and timeframe whose price scale I stretched by hand to open with that same height, centred on the current price, so that I do not re-zoom every time.

## Acceptance criteria

- AC 1. WHEN the operator changes the horizontal zoom (wheel, pinch or dragging the time axis) on a timeframe THEN that zoom is remembered for that timeframe, in this browser.
- AC 2. WHEN the chart loads any broker and pair on a timeframe with a remembered horizontal zoom THEN it opens with that zoom, the latest candle in view at the usual distance from the right edge.
- AC 3. WHEN the operator stretches or shrinks the price scale by hand on a pair and timeframe THEN the visible price height is remembered for that pair and timeframe (as a height, not as fixed prices).
- AC 4. WHEN the chart loads a pair and timeframe with a remembered price height THEN the scale opens with that height centred on the current price; WHEN the operator returns the scale to automatic (double click on the price axis) THEN the remembered height is forgotten and it opens on automatic again.
- AC 5. WHEN there is nothing remembered THEN the chart opens as today (6 px per candle, automatic scale).
- AC 6. WHEN the chart is split in two THEN both sides read and write the same memory: the zoom goes with the timeframe (and the pair), not with the side.
- AC 7. WHEN the operator opens a position or order from the journal (double click or double tap) THEN the chart opens on the last timeframe used, with its remembered zoom.
- AC 8. WHEN loading older candles while scrolling back THEN the zoom does not change (as today).

## Out of scope

- Syncing the zoom between devices (it stays per browser: a phone and a desktop have very different widths).
- Remembering the scroll position in time (the chart always opens on the latest candle).
- Zoom memory per broker (the same pair zooms the same in every broker).
