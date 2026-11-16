# 044 — MT4 as the complete and only source of candles · Design

## Approach

Three independent corrections, one per cause, so that the database converges to what MT4 holds without any manual step:

| Cause | Layer | Correction |
|---|---|---|
| A stale bar is stored as a closed candle with today's price | backend | A rollover candle is produced only when the previous bar was really the bar in progress |
| A wrong stored candle is never corrected | backend | Every closed bar of an EA file overwrites the stored row when its values differ |
| History downloaded after the EA started is never exported; MT4 does not download it by itself | ea | The EA makes MT4 load the history and exports it in full again whenever it grows |

The existing EA ↔ backend contract does not change (same candle files, same JSON, same pipe messages); one file is **added**, `history_status.json`. An old EA keeps working with the new backend and the other way round.

## Backend

### 1. Rollover candle only from a bar in progress — `services/candle-close.ts`

Today `trackCandleCloses` emits the previous snapshot as a closed candle whenever `<tf>_time` changes. The snapshot gains the server time of its last tick, `serverNow = tick.time + tick.broker_offset * 1000` (which equals MT4's `TimeCurrent`, in the same broker-time base as the bar time), and a candle is emitted only when both hold:

- `prev.time <= prev.serverNow < prev.time + period` — the bar was in progress at its last tick;
- `prev.low <= prev.bid <= prev.high` — the closing price belongs to the bar.

A terminal that starts with stale history fails the first condition (bar of 20 October, server time of today), so nothing is stored and no `candle` message is broadcast for it. The real candle arrives with the EA's file. Over a weekend `TimeCurrent` stays at Friday's last quote, so Friday's last bar still passes and is emitted at Monday's open, as today.

Accepted side effect: a symbol with no quote during a whole bar no longer gets its rollover candle from ticks; it arrives with the next EA file (≤ 60 s later). The frontend's active candle is not affected.

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

## EA — `ea/HttpBridgeState.mq4`

### 3. Export in full again when the history grows

Per symbol and timeframe the EA remembers the bar count of its last export. In each state cycle (60 s): if `iBars` grew by more than the one bar a cycle can add, that pair is queued for a **full** export; otherwise the usual last `RECENT_BARS`. The queue is drained one file per second from `OnTimer`, so a burst of 75 full exports never blocks the 100 ms tick batches (today `OnInit` writes all 75 at once before the first tick).

### 4. Make MT4 load the history

MT4 keeps on disk only the history something has asked for, and a timeseries request from an EA returns what is stored while the download happens in the background (error `4066`, history will be updated). What MT4 actually downloads for a symbol with no open chart, and how deep, is **not established**: on the new VPS FTMO went from 201 to 2,093 October M15 candles between two EA starts, while the Solidary accounts stayed between 1,088 and 1,720 of 2,112. So the first EA task is a measurement on the `Demo` terminal, and the mechanism is chosen from its result:

| | E1. Timeseries requests | E2. Temporary charts |
|---|---|---|
| How | Request each symbol and timeframe (`iBars` / `CopyRates`) and retry while MT4 answers `4066`, until the bar count is stable | `ChartOpen` each symbol and timeframe, `ChartNavigate` to the beginning to pull older blocks, `ChartClose` when the count is stable |
| Pros | No visible side effect, simple | It is what makes the data appear when the user opens a chart by hand |
| Cons | May not fill a hole in the middle of the stored history | 75 charts opened and closed at start, memory peak, more code |

Evidence gathered with the user on 2026-11-16: on `Demo` the app held about 2,090 M5 candles per symbol, all starting on 5 November. The user scrolled the EURUSD M5 chart back to January in MT4 and reloaded the EA: EURUSD M5 became 65,000 candles from 2 January 2026, while the other 14 symbols and the other EURUSD timeframes did not change. So the export path delivers whatever MT4 holds, and what loads the history is the chart being scrolled — which makes E2 the likely mechanism. The round figure of 65,000 suggests a terminal limit ("Max bars in chart"); not verified.

Whichever is chosen, it runs staggered (one symbol and timeframe at a time) and its only output is a larger `iBars`, which point 3 then exports.

## How completeness is known (AC 9, AC 10)

MQL4 has no call that asks the broker "how much history exists". What can be established, and is enough to detect every problem seen so far, is three facts per symbol and timeframe:

| Fact | Who measures it | How |
|---|---|---|
| MT4 has finished downloading | EA | No pending `4066` and a stable bar count over consecutive cycles |
| The history has no hole | EA | **Cross-check against D1**: every day that has a D1 bar inside the range of that timeframe must have at least one bar in it. D1 is the reference because it is small and MT4 holds it complete (since 2018–2020 on these accounts). A day present in D1 and absent in M15 is a hole, never a weekend or a holiday |
| The database equals MT4 | backend | Stored closed bars between the first and last time reported by the EA = bars reported by the EA minus the one in progress |

- The EA writes one extra file, `bridge/history_status.json`: per symbol and timeframe `bars`, `first`, `last`, `downloading` (bool) and `missingDays` (count, plus the first few dates). New file, additive: a backend that does not know it ignores it.
- The backend reads it with the same watcher, compares with `candles` and keeps the result in memory per broker: `complete`, `downloading` or `incomplete` with the list of symbol and timeframe pairs and the reason (hole in MT4 / database behind). `GET /health` gains a `history` field per broker; nothing is stored and the `status` of `/health` does not depend on it.
- The EA uses `missingDays` itself: while it is above zero, that pair stays in the download queue of point 4.

What this cannot tell: whether the broker has history older than the first bar MT4 holds. That is outside the spec.

## Data flow

Unchanged: EA → `candles_<SYM>_<TF>.json` → file watcher → `candles`; ticks → rollover candle → `candles` + `candle` WS message. Only what is allowed to be written changes.

## Convergence of the new system (AC 7)

After the deploy, each terminal's next full exports overwrite the false candles and fill the gaps. The check is two queries on the new database, both expected to reach their target without touching rows by hand: candles with open or close outside high–low = 0; EURUSD M15 candles of October equal for all accounts of the same broker feed.

## Files to touch

- `backend/src/services/candle-close.ts`, `candle-close.test.ts`
- `backend/src/services/candles.ts` (+ test)
- `backend/docs/architecture.md`, `.claude/CLAUDE.md` — "Velas activas y alertas" / candle authority
- `ea/HttpBridgeState.mq4` (version bump, `history_status.json`), `ea/docs/`
- `backend/src/bridge/file-watcher.ts`, a new `services/history-status.ts` (+ test), `routes` of `/health`

## Dependencies

None added.

## Deploy

Backend first, then EA, on the **new** system only: this spec's push carries the four pending commits of spec 043 (tasks 9–12) that point the pipelines at the new server. The old VPS keeps its current code.

## Risks

- **MT4 may not download a hole in the middle of its history by any programmatic means.** Then AC 3 cannot be met in full; the measurement task reports it before the EA is written and the user decides.
- **Full exports are large** (up to ~27,000 bars per file, 75 files per terminal, 13 terminals). Staggering in the EA and the no-op `WHERE` in the backend bound the load; memory and CPU are read on the new VPS during validation.
- **Server time base.** The rollover rule relies on `time + broker_offset` equalling MT4's `TimeCurrent`; covered by tests with real tick samples, including a weekend sequence.
- **A false candle whose bar MT4 never obtains** would stay stored. The validation query shows it; it is not deleted by hand without the user's decision.
