# 044 — MT4 as the complete and only source of candles · Verification

## Task 1 — Rollover candle only from a bar in progress

- **Mechanism:** vitest + `npm run build` (plus `npm run lint` and the whole suite).
- **Outcome:** ✅ pass (2026-11-16)
- **Evidence:**
  - `services/candle-close.ts`: the snapshot keeps `serverNow = tick.time + tick.broker_offset × 1000`; a candle is emitted only when `time <= serverNow < time + 2 × period` and `low <= bid <= high`.
  - `npx vitest run src/services/candle-close.test.ts`: 8 tests pass. The 4 existing ones are unchanged (normal rollover, several timeframes at once, brokers and symbols kept apart, missing bar time). New: a stale bar of 20 October reported with the server time of 16 November emits nothing; a bid outside the bar range emits nothing; a bar whose symbol stayed quiet into the next period is still closed; Friday's last H1 bar is closed at Monday's open with the server clock stopped over the weekend.
  - `npm run build` and `npm run lint` clean; `npm test`: 17 files, 150 tests pass.
- **Deviation from the first draft of the design:** the window is two periods, not one. With one period, a symbol with no quote in the first second of a new bar would lose its rollover candle at almost every bar (the server clock is shared by all symbols). The design was updated.
- **Not yet proven:** the behaviour on real terminals — task 7.
- **Est vs Actual:** 1.5 SP vs 1 SP.
