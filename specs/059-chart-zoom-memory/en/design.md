# 059 — Chart zoom memory · Design

> Status: **approved**

## Approach

A small module keeps the zoom in the browser (`localStorage`, key `chart.zoom`), and `LightweightChart` reads it when a history loads and writes it when the operator zooms. Both sides of a split chart use the same component, so they share the memory without anything else (AC 6).

```ts
// features/chart/zoomMemory.ts
interface ChartZoom {
  barSpacing: Partial<Record<string, number>>;   // by timeframe: px per candle
  priceHeight: Partial<Record<string, number>>;  // by `${symbol}|${timeframe}`: visible price span
}
readBarSpacing(timeframe): number | null
saveBarSpacing(timeframe, px): void
readPriceHeight(symbol, timeframe): number | null
savePriceHeight(symbol, timeframe, height | null): void   // null = back to automatic
```

Plain functions, not a hook: the chart reads them imperatively at load time and writes them from library callbacks. Reads and writes are wrapped in `try` (storage full or unavailable → the chart works as today). Values outside sane bounds (bar spacing 0.5–100 px, non-positive heights) are ignored.

## Horizontal zoom (AC 1, 2, 5, 8)

- **Apply**: the history load that today sets `barSpacing: 6` and scrolls to 30 % from the right uses `readBarSpacing(tf) ?? 6`. The "load more" path (older candles) is untouched, so it keeps the zoom (AC 8).
- **Save**: the existing `subscribeVisibleLogicalRangeChange` handler compares `timeScale().options().barSpacing` with the last value seen; when it changed, it saves it for the current timeframe after a 400 ms pause (one write per gesture, not per frame).

## Vertical zoom (AC 3, 4, 5)

The library has no price-scale change event, so the chart checks the scale **at the end of each interaction** on its container (`pointerup`, `touchend`, and a 400 ms pause after `wheel`):

- scale on manual (`autoScale: false`) → save `to − from` of `priceScale().getVisibleRange()` for symbol + timeframe;
- scale back on automatic (the library's double click on the price axis) → `savePriceHeight(…, null)`.

**Apply**: after a history load, with a remembered height, set `autoScale: false` and `setVisibleRange({ from: close − h/2, to: close + h/2 })` around the last candle's close. Without one, automatic as today.

The height is a price span (e.g. 0.0040 on EURUSD), so it is only valid for its own pair: that is why it is keyed by pair and timeframe, not shared across pairs.

A vertical pan also leaves the scale on manual (it is how the library allows panning, see `beginPanePan`); its height is saved too. That is intended: after a pan the operator chose a manual scale, and the next load opens with that height centred on the price.

## Journal (AC 7)

Done outside the spec, in `7748cdb fix(frontend): open the chart from the journal on the last timeframe`: positions and orders no longer force H1, so the chart opens on the last timeframe, and with this spec on its zoom.

## Files

| File | Change |
|---|---|
| `frontend/src/features/chart/zoomMemory.ts` | new: read / save functions |
| `frontend/src/features/chart/LightweightChart.tsx` | apply on history load; save horizontal on range change; save vertical at the end of each interaction |

No backend, DB or EA change. No new dependency.

## Mockup

Not applicable: no screen, panel or control changes; the chart only reopens with the zoom it had.

## Risks

- **Restoring a height on a pair whose price moved a lot** (e.g. after a big gap): the height is still sensible because it is centred on the current close.
- **A very different window width** (desktop vs phone in the same browser profile is rare): bar spacing is in px per candle, so a narrow window simply shows fewer candles.
- **Library behaviour**: `priceScale().setVisibleRange` and `getVisibleRange` exist in lightweight-charts 5.2 (`typings.d.ts`); verified in the local app as part of the task.
