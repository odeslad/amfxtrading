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

## Tasks 3 and 4 — Full history from MT4, without holes (backend + EA)

- **Mechanism:** vitest + `npm run build` for the backend; for the EA, compile on the new VPS and four runs on the `Demo` terminal, each started by the user reloading the EA by RDP, measured in the EA log, the backend log and the database.
- **Outcome:** ✅ pass (2026-11-16)
- **How MT4 loads history (measured, EURUSD M15 on `Demo`):** timeseries requests 2,065 → 2,065; `ChartOpen` + `ChartNavigate` 2,064 → 2,064; `ChartOpen` + Home key 2,065 → **65,425** (back to 1 April 2024).
- **Runs on `Demo`:**
  1. *Request + `ChartNavigate`:* nothing loaded (figures above). Discarded.
  2. *Home key, full history in the regular file:* 75 pairs in about 75 minutes, `Demo` from 263,588 to 2,273,428 candles, 0 pipe timeouts. Two defects found: full exports overwritten by the 60 s cycle before the backend read them (CADJPY M15: 65,430 bars in the EA log, 2,070 in the database; also GBPAUD H1 and GBPCAD D1), and a hole in H4 for EURUSD, GBPUSD (676 trading days, October 2015 – May 2022) and USDJPY (1,500 days, to July 2025) behind an old island of history from 2009.
  3. *Own file + stretch without holes + trim:* about 16 s per pair with the history already on disk; files stored and deleted by the backend; EURUSD H4 exported as "6998 without holes of 19075" and 12,077 older candles dropped. Defect found: the trim was unconditional and also cut the oldest edge of pairs with no hole (EURUSD M5 29 candles, M15 432; EURGBP M5 480, M15 432 — **not restored**). Fixed with the `cutAtHole` flag: the backend trims only when the EA cut at a hole.
  4. *Final build (no request phase, short wait when nothing arrives):* about 7 s per pair, the 75 pairs in about 12 minutes, 0 pipe timeouts.
- **Database after run 4 (`Demo`, 2,430,054 candles):**
  - days with a D1 candle and no candle in M5, M15, H1 or H4, inside each timeframe's range: **0** for the 15 symbols; D1 gaps longer than five days: **0**;
  - candles with open or close outside high–low: **0** (41 before);
  - depth per symbol: M5 65,004–65,484 (from January 2026); M15 65,000–65,433 (April 2024); H1 21,841 for all (May 2023); H4 6,997 (May 2022) except USDJPY 2,053 (July 2025, its hole reached that far); D1 2,515–2,872 (2015–2017);
  - the pairs lost in run 2 are present: CADJPY M15 65,000, GBPAUD H1 21,841, GBPCAD D1 2,872.
- **Backend:** `npx vitest run src/bridge/file-watcher.test.ts src/services/candles.test.ts`: 15 tests pass (4 new for the full history file, 2 for the history start); `npm run build` and `npm run lint` clean. For the `Demo` runs the backend of the new VPS was built from these sources copied by hand; the pipeline deploy is task 5.
- **Known limits:** a pair is only as deep as its stretch without holes (USDJPY H4); the first load of a terminal takes about an hour and opens and closes charts by itself; with about 2.4 million candles per broker the table is expected to grow from 7.8 to around 29 million rows — chart load time with that volume is measured in task 5.
- **Est vs Actual:** planned 2 (measurement) + 3 (EA) + 1.5 + 2 (status file and `/health`, dropped) = 8.5 SP; actual about 6 SP for tasks 3 and 4 as redefined.
