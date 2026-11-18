# 049 — Candle history sync from Settings

> Status: **closed**

## Context
Candles reach the database only from MT4: the EA writes `candles_<SYM>_<TF>.json` every 60 s and the backend saves each candle that closes on the tick. How far back the history goes depends on what each MT4 had downloaded, and there is no way to see or control it from the app. The `candles` table also has damaged pages (~8 M rows, 2.1 GB): a full read or a full `pg_dump` fails, which blocks moving to another server. This spec gives the operator a manual, per broker and timeframe, way to rebuild the candle history from the EA, with a target number of candles set in Settings.

## Affected layers
- frontend · backend · db · ea

## User stories
- As the operator, I want to see, for each broker and timeframe, how many candles the database holds and when they were last synced, so that I know the state of the history.
- As the operator, I want to set the number of candles to keep for each broker and timeframe, so that each chart has the depth I need.
- As the operator, I want to launch a sync by hand for the timeframes I mark in one broker, so that its history is rebuilt from MT4 without touching the rest.

## Acceptance criteria
- AC 1. WHEN the operator opens Settings › Data sync THEN they see one row per broker and timeframe with the number of candles in the database and the date of the last sync (or "never").
- AC 2. WHEN the operator changes the target number of candles of a broker and timeframe and saves THEN the value is kept and used by the next sync of that pair.
- AC 3. WHEN the operator marks one or more timeframes of a broker and launches the sync THEN the backend asks that broker's EA to fetch, for every symbol configured in that EA, the target number of candles of each marked timeframe.
- AC 4. WHEN MT4 does not hold enough history for a symbol and timeframe THEN the EA opens a temporary chart to make MT4 download history back to the target, and closes that chart when it is done.
- AC 5. WHEN the EA delivers the candles of a timeframe THEN the backend replaces the candles of that broker and timeframe (all its symbols) with the delivered ones; other brokers and timeframes are not touched.
- AC 6. WHEN the broker has fewer candles than the target THEN everything available is stored and the row shows the real number reached.
- AC 7. WHILE a sync runs THEN its row in Settings › Data sync shows its state live, without reloading the page (queued, in progress with the timeframe and symbol being fetched, done, or error with the reason), and at the end updates the number of candles and the date of the last sync. WHEN the operator leaves Settings and comes back, or opens it on another device, THEN they see the same current state.
- AC 8. WHEN a sync fails or the EA is not connected THEN no candle is deleted: the previous history stays as it was.
- AC 9. WHEN a sync of a broker is in progress THEN another sync of the same broker cannot be launched.
- AC 10. WHILE a sync runs THEN ticks, positions, orders and the automatic saving of new closed candles keep working as today.
- AC 11. WHEN every broker and timeframe has been synced THEN the `candles` table has no damaged pages: a full read and a full `pg_dump` of the database succeed.

## Out of scope
- Automatic or scheduled syncs: every sync is launched by hand.
- Choosing symbols: the sync always covers every symbol configured in the EA of that broker.
- Changing how new closed candles are saved day to day.
- Candles from any source other than MT4.
- Moving to another server (it comes after this spec).
