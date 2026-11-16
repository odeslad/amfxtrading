# 044 — MT4 as the complete and only source of candles

> Status: **implementing**

## Context

Candles reach the database only from MT4: the EA writes `candles_<SYM>_<TF>.json` and the backend stores the closed bars. During the VPS migration ([spec 043](../../043-vps-migration/en/requirements.md)) the new system started with an empty `candles` table and showed what that path really delivers: gaps of weeks (EURUSD M15 in October 2026 has between 1,088 and 2,093 candles per broker where a full month is about 2,112) and 216 stored candles whose close lies outside their high–low range, drawn as long false wicks. The broker has the data and MT4 shows it on its own charts; it is lost on the way. Three causes, read in the code:

1. The EA exports the whole history only in `OnInit`, with whatever MT4 holds on disk at that instant; from then on it writes only the last 100 bars every 60 s. History that MT4 downloads later is never exported.
2. `services/candle-close.ts` stores the previous bar, closed with the latest bid, whenever a timeframe's bar time changes. A terminal that starts with stale history reports an old bar as the current one, so an old candle is stored with today's price.
3. `services/candles.ts` inserts missing rows and overwrites only the last two closed bars, so a wrong stored candle is never corrected by the EA's file.

The old VPS runs the same code; its table looks complete only because it was filled 100 bars at a time over months. The user's rule for this spec: **candles come from MT4, never from manual inserts or from another database**.

## Affected layers

- ea
- backend

## User stories

- As the operator, I want every chart of the app to show the same candles MT4 shows for that broker, so that I can trust the app without checking the terminal.
- As the operator, I want a terminal that starts, restarts or reconnects to leave no false candle behind, so that indicators and EMAs are not distorted.
- As the developer, I want a database that can be emptied and rebuilt from MT4 alone, so that a migration or a damaged table never requires rescuing rows by hand.

## Acceptance criteria

- AC 1. WHEN the EA starts on a terminal THEN it asks MT4 for the history of every configured symbol and timeframe and, once MT4 has it, exports it complete — without anyone opening a chart in the terminal.
- AC 2. WHEN MT4 obtains more history for a symbol and timeframe after the EA started (a late download, a reconnection) THEN the EA exports it without being restarted.
- AC 3. WHEN the full export of a symbol and timeframe has been stored THEN the database has no gap inside the range MT4 holds: for a past month fully inside that range, accounts that share a broker feed have the same number of candles.
- AC 4. WHEN a terminal starts or reconnects with stale history THEN the backend stores no candle built from a bar that was not really the bar in progress, and no stored candle has its open or close outside its high–low range.
- AC 5. WHEN the EA's full export contains a candle that is already stored with different values THEN the stored candle takes the EA's values.
- AC 6. WHEN the system runs in its normal cycle (last bars every 60 s) THEN the candle work per cycle stays of the same order as today: the full history is not rewritten every minute.
- AC 7. WHEN this spec is deployed on the new system THEN the gaps and the false candles already stored there disappear through the EA's own exports, with no manual SQL on the `candles` table.
- AC 8. WHEN the candles of a closed bar are stored THEN live behaviour is unchanged: the `candle` WebSocket message at the rollover (spec 025), the active candle built by the frontend from ticks, and the EMA alerts evaluated at candle close.
- AC 9. WHEN the EA has exported a symbol and timeframe THEN the system can tell, without anyone looking at a chart, whether that history is complete: the EA reports per symbol and timeframe how many bars MT4 holds, their first and last time, whether MT4 is still downloading, and how many trading days inside that range have no bars; the backend compares those figures with what it has stored and exposes the result per broker.
- AC 10. WHEN a symbol and timeframe is reported as complete THEN three things hold: MT4 is not downloading anything for it, it has no trading day without bars inside its range, and the database holds exactly the closed bars MT4 reports for that range.

## Out of scope

- Recovering candles from the old database or from any source other than MT4.
- Candles older than what the broker serves through MT4. How far back a broker's history goes cannot be verified from MT4; "complete" means continuous and identical to MT4, not "as old as possible".
- Any frontend change.
- The pending EA refactor (stop writing `positions.json`).
- The accounts that do not connect (`demo`, `solidary isa`).
