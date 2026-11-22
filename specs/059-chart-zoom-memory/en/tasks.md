# 059 — Chart zoom memory · Tasks

Each task is one conventional commit. The project must build after every task. Deploy order: frontend only.

- [ ] 1. [frontend] `zoomMemory.ts` (read / save bar spacing by timeframe and price height by pair + timeframe, bounds and storage errors ignored) and the horizontal zoom in `LightweightChart`: apply on history load, save on range change after a 400 ms pause · **Verify:** `npm run build` + local app: zoom M5 and H1 differently, switch timeframes and pairs, reload, open from the journal → each timeframe opens with its zoom; nothing stored → 6 px as today; loading older candles keeps the zoom · **Est:** 1.5 SP
- [ ] 2. [frontend] Vertical zoom: save the visible price height at the end of each interaction while the scale is manual, forget it when it returns to automatic, apply it centred on the last close after a history load · **Verify:** `npm run build` + local app: stretch the price scale on EURUSD H1, reload → same height around the price; USDJPY H1 still automatic; double click on the price axis → automatic and reload stays automatic; split chart shares it · **Est:** 1.5 SP
- [ ] 3. [infra] Push `master`, deploy the frontend when the user asks, and **validate on production**: horizontal zoom per timeframe, vertical height per pair and timeframe, reset with double click, both sides of the split chart, opening from the journal · **Verify:** manual (user validation) · **Est:** 0.5 SP
- [ ] 4. [specs] Record Est vs Actual in `verification.md` (both languages), mark the spec closed and archive it under `archive/2026-11/` (or the closing month) · **Verify:** manual · **Est:** 0.25 SP

**Total estimate**: 3.75 SP
