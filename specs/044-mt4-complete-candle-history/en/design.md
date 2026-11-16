# 044 — MT4 as the complete and only source of candles · Design

## Approach

Three independent corrections, one per cause, so that the database converges to what MT4 holds without any manual step:

| Cause | Layer | Correction |
|---|---|---|
| A stale bar is stored as a closed candle with today's price | backend | A rollover candle is produced only when the previous bar was really the bar in progress |
| A wrong stored candle is never corrected | backend | Every closed bar of an EA file overwrites the stored row when its values differ |
| History downloaded after the EA started is never exported; MT4 does not download it by itself | ea + backend | The EA makes MT4 load the history through a temporary chart, exports the stretch without holes in a file of its own, and the backend stores it and drops what lies behind a hole |

The existing EA ↔ backend contract does not change (same candle files, same JSON, same pipe messages); one file is **added**, `fullcandles_<SYM>_<TF>.json`. An old EA keeps working with the new backend and the other way round.

## Backend

### 1. Rollover candle only from a bar in progress — `services/candle-close.ts`

Today `trackCandleCloses` emits the previous snapshot as a closed candle whenever `<tf>_time` changes. The snapshot gains the server time of its last tick, `serverNow = tick.time + tick.broker_offset * 1000` (which equals MT4's `TimeCurrent`, in the same broker-time base as the bar time), and a candle is emitted only when both hold:

- `prev.time <= prev.serverNow < prev.time + 2 × period` — the bar was the one in progress at its last tick. The second period is the margin for a symbol that has no quote in the first seconds (or minutes) of the next bar: its bar time has not moved yet although the server clock has;
- `prev.low <= prev.bid <= prev.high` — the closing price belongs to the bar.

A terminal that starts with stale history fails the first condition (bar of 20 October, server time of today), so nothing is stored and no `candle` message is broadcast for it. The real candle arrives with the EA's file. Over a weekend `TimeCurrent` stays at Friday's last quote, so Friday's last bar still passes and is emitted at Monday's open, as today.

Accepted side effects: a symbol with no quote for more than a whole bar no longer gets its rollover candle from ticks, it arrives with the next EA file (≤ 60 s later); a terminal that was offline for less than two periods can still produce one candle closed with a late bid, which the EA's file then corrects (point 2). The frontend's active candle is not affected.

### 2. The EA's file has authority over every closed bar — `services/candles.ts`

Today: `createMany … skipDuplicates` plus an upsert of the last two closed bars. Replaced by a single statement per chunk:

```sql
INSERT INTO candles (broker, symbol, timeframe, time, open, high, low, close)
SELECT … FROM unnest(…)
ON CONFLICT (broker, symbol, timeframe, time) DO UPDATE
  SET open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low, close = EXCLUDED.close
  WHERE (candles.open, candles.high, candles.low, candles.close)
        IS DISTINCT FROM (EXCLUDED.open, EXCLUDED.high, EXCLUDED.low, EXCLUDED.close);
```

- Rows that already match are not rewritten (the `WHERE` makes the update a no-op), so the normal 60 s cycle costs what it costs today: one indexed statement per file (AC 6).
- A full export corrects every stored row that differs — this is what removes the 216 false candles (AC 5, AC 7).
- `AUTHORITATIVE_TAIL` and the per-row upserts disappear; the rule "the EA's file keeps authority" (spec 025) now covers all bars instead of two.
- Run with `db.$executeRaw` and typed arrays; no schema change, no migration.

### Alternatives considered for point 2

| | Chosen: authority on every bar | Flag `"full": true` in the file | Separate file for the full export |
|---|---|---|---|
| Contract change | none | new optional field | new file name |
| Fixes a wrong candle inside the last 100 bars | yes | no | no |
| Code paths | one | two | two |

## EA — `ea/HttpBridgeState.mq4` (as built and measured on `Demo`)

### 3. Make MT4 load the history: a temporary chart taken to its beginning

Measured on the `Demo` terminal on 2026-11-16, with the real EA:

| Mechanism | EURUSD M15 bars |
|---|---|
| Before | 2,065 |
| Timeseries requests (`iBars` / `iTime`, waiting on error 4066) | 2,065 — nothing |
| `ChartOpen` + `ChartNavigate(CHART_BEGIN)` | 2,064 — nothing |
| `ChartOpen` + the **Home key** posted to the chart window | 65,425, back to April 2024 |

So the EA loads the 15 symbols × 5 timeframes one pair at a time: it opens a temporary chart, turns autoscroll off and, once per second, navigates to the beginning and posts `WM_KEYDOWN`/`WM_KEYUP` of `VK_HOME` to the chart's window (`user32.dll`, which joins the `kernel32.dll` import the EA already needs). The chart is closed when no bar has arrived for `CANDLES_IDLE_S` (5 s), or, once bars started to arrive, for `CANDLES_STABLE_S` (12 s), or after `CANDLES_CHART_MAX_S` (120 s). MT4 holds about 65,000 bars per chart.

Timing on `Demo`: first load, from the broker, about 75 minutes for the 75 pairs; with the history already on disk, about 12 minutes. The 100 ms tick batches were never interrupted (0 pipe timeouts in every run).

### 4. Full history in its own file, exported when it is loaded and when it grows

- The last `RECENT_BARS` keep going to `candles_<SYM>_<TF>.json` every 60 s, as before.
- A **full** history goes to `fullcandles_<SYM>_<TF>.json`, written under a `.tmp` name and renamed. It is queued when a pair finishes loading and whenever its bar count grows by more than a state cycle can add; the queue is drained one file per second.
- A separate file was needed: in the first version the full history was written to the regular file and the next 60 s cycle overwrote it before a busy backend had read it (CADJPY M15 reached the EA's log with 65,430 bars and the database with 2,070).

### 5. Only the stretch without holes

MT4 can hold an old island of history that the recent bars do not connect to (on `Demo`: H4 of EURUSD, GBPUSD and USDJPY from 2009, then nothing until 2022 or 2025). The Home key jumps to the island's first bar and fetches nothing in between.

The full export therefore contains only the bars, counted from the newest, that form a history without holes: for D1, no gap longer than five days between consecutive bars; for the other timeframes, every day that has a D1 bar must have at least one bar, checked from today backwards until the first day that fails. Bars older than the D1 history are left out too. When bars were left out the file carries `"cutAtHole": true`.

## Backend — the full history file

- `bridge/file-watcher.ts` recognises `fullcandles_<SYM>_<TF>.json`, hands it to `onFullCandles` and **deletes the file** once it is stored, so it is neither read again on the next poll nor after a restart. A failed write leaves it for the next poll; the `.tmp` file is ignored.
- `services/candles.ts` `replaceCandleHistory`: stores the bars with the statement of point 2 and, only when the file says `cutAtHole` and brings at least 500 closed bars, deletes the stored candles of that pair older than the file's first bar. Without `cutAtHole` nothing is deleted, so the table accumulates beyond the terminal's 65,000-bar window. The 500-bar floor keeps a terminal that has not loaded its history from wiping what is stored.

Contract: one file is added (`fullcandles_*`); an old backend ignores it, an old EA never writes it.

## Data flow

Unchanged: EA → `candles_<SYM>_<TF>.json` → file watcher → `candles`; ticks → rollover candle → `candles` + `candle` WS message. Only what is allowed to be written changes.

## Convergence of the new system (AC 7)

After the deploy, each terminal's next full exports overwrite the false candles and fill the gaps. The check is two queries on the new database, both expected to reach their target without touching rows by hand: candles with open or close outside high–low = 0; EURUSD M15 candles of October equal for all accounts of the same broker feed.

## Files to touch

- `backend/src/services/candle-close.ts`, `candle-close.test.ts`
- `backend/src/services/candles.ts` (+ test)
- `backend/docs/architecture.md`, `.claude/CLAUDE.md` — "Velas activas y alertas" / candle authority
- `ea/HttpBridgeState.mq4` (version 3.16), `ea/docs/`
- `backend/src/bridge/file-watcher.ts` (+ test), `backend/src/index.ts`

## Dependencies

None added.

## Deploy

Backend first, then EA, on the **new** system only: this spec's push carries the four pending commits of spec 043 (tasks 9–12) that point the pipelines at the new server. The old VPS keeps its current code.

## Risks

- **A hole in the middle of MT4's history is not downloaded by any means found.** Resolved by exporting only the stretch without holes and dropping what lies behind it (decision of the user); the cost is depth: USDJPY H4 on `Demo` starts in July 2025.
- **Full exports are large** (up to ~27,000 bars per file, 75 files per terminal, 13 terminals). Staggering in the EA and the no-op `WHERE` in the backend bound the load; memory and CPU are read on the new VPS during validation.
- **Server time base.** The rollover rule relies on `time + broker_offset` equalling MT4's `TimeCurrent`; covered by tests with real tick samples, including a weekend sequence.
- **A false candle whose bar MT4 never obtains** would stay stored. The validation query shows it; it is not deleted by hand without the user's decision.
