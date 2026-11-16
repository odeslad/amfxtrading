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

## Task 2 — The EA's file has authority over every closed bar

- **Mechanism:** vitest + `npm run build` + manual run against a throwaway database.
- **Outcome:** ✅ pass (2026-11-16)
- **Evidence:**
  - `services/candles.ts`: `createMany … skipDuplicates` and the upsert of the last two bars replaced by one `INSERT … ON CONFLICT DO UPDATE … WHERE … IS DISTINCT FROM` per chunk, through `db.$executeRaw` with `unnest` of five arrays. `upsertCandles` now returns the rows written.
  - `npx vitest run src/services/candles.test.ts`: 4 tests pass (forming bar dropped; empty and single-bar files; a time repeated in the file keeps its last values; columns lined up by position).
  - Manual, against a database `amfx_spec044` created on the new VPS with only the `candles` table (schema copied from `amfxtrading`) and dropped afterwards; the real `upsertCandles` run from the developer PC through an SSH port forward:
    1. file with 3 closed bars → 3 rows written;
    2. the middle candle changed by hand to close 1.10031 (a false candle), same file again → **1 row written**, closes back to 1.1211, 1.1212, 1.1213;
    3. same file again → **0 rows written**;
    4. file with one more closed bar → 1 row written; the forming bar is never stored; times stored as UTC (`2026-10-20T13:00:00.000Z`);
    5. file of 27,000 closed bars → 27,000 rows in 1.4 s; the same file again → **0 rows in 1.1 s**.
  - `npm run build` and `npm run lint` clean. `backend/docs/architecture.md` and `.claude/CLAUDE.md` updated in the same commit.
- **Finding outside this task:** `npm test` passed 154 of 154 in some runs and failed one test in others, always the same: `src/bridge/pipe-reader.test.ts > PipeReader on a real named pipe > retries a busy pipe with backoff…`. It passes 5 times out of 5 when run alone, its files were not touched by this spec, and it depends on real timing over a named pipe, so it looks sensitive to load when the whole suite runs in parallel. It can make the backend pipeline's check fail at random; not fixed here.
- **Est vs Actual:** 2 SP vs 1.5 SP.
